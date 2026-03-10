import ChallengePrompt from "@/app/components/ChallengePrompt";
import ChallengesList from "@/app/components/ChallengesList";
import LeaderboardGraph from "@/app/components/LeaderboardGraph";
import Link from "next/link";
import { FireIcon, ShieldCheckIcon } from "@heroicons/react/24/solid";
import { Metadata } from "next";
import { ChallengeMetadata, type Challenge } from "@arena/engine/types";
import type { ScoringEntry } from "@arena/engine/scoring/types";
import type { UserProfile } from "@arena/engine/users";
import { ENGINE_URL } from "@/lib/config";
import { tagColors } from "@/lib/tagColors";

interface ScoringEntryWithProfile extends ScoringEntry {
  username?: string;
  model?: string;
  isBenchmark?: boolean;
}

async function fetchChallengeScoring(challengeType: string): Promise<Record<string, ScoringEntryWithProfile[]>> {
  try {
    const res = await fetch(`${ENGINE_URL}/api/scoring/${challengeType}`, { cache: "no-store" });
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

function graphDataFromScoring(data: Record<string, ScoringEntryWithProfile[]>) {
  const entries = data["average"] || Object.values(data)[0] || [];
  const strategyPrefix = data["average"] ? "average" : Object.keys(data)[0] || "average";
  return entries.map((entry) => ({
    playerId: entry.playerId,
    name: entry.username ?? entry.playerId.slice(0, 8),
    securityPolicy: entry.metrics[`${strategyPrefix}:security`] ?? 0,
    utility: entry.metrics[`${strategyPrefix}:utility`] ?? 0,
    model: entry.model,
    isBenchmark: entry.isBenchmark,
  }));
}

async function fetchMetadata(name: string): Promise<ChallengeMetadata | null> {
  try {
    const res = await fetch(`${ENGINE_URL}/api/metadata/${name}`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const challenge = await fetchMetadata(name);

  const metadata: Metadata = {
    title: challenge ? `ARENA - ${challenge.name}` : "ARENA - Challenge Not Found",
    description: challenge?.description || "",
  };
  return metadata;
}

export default async function ChallengePage({ params, searchParams }: { params: Promise<{ name: string }>; searchParams: Promise<{ page?: string }> }) {
  const { name } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam || "1", 10) || 1);
  const pageSize = 10;
  const offset = (page - 1) * pageSize;

  const challenge = await fetchMetadata(name);
  if (!challenge) {
    return <div>Challenge {name} not found</div>;
  }

  // Fetch challenges and scoring in parallel
  let challengesList: Challenge[] = [];
  let profiles: Record<string, UserProfile> = {};
  let challengesTotal = 0;
  const [challengesResult, allScoring, stats] = await Promise.all([
    fetch(`${ENGINE_URL}/api/challenges/${name}?limit=${pageSize}&offset=${offset}`, { cache: 'no-store' })
      .then(res => res.ok ? res.json() : null)
      .catch(() => null),
    fetchChallengeScoring(name),
    fetch(`${ENGINE_URL}/api/stats`, { cache: 'no-store' })
      .then(res => res.ok ? res.json() : null)
      .catch(() => null),
  ]);
  if (challengesResult) {
    challengesList = challengesResult.challenges || [];
    profiles = challengesResult.profiles || {};
    challengesTotal = challengesResult.total ?? challengesList.length;
  }
  const scoringData = graphDataFromScoring(allScoring);
  const redTeamData = (allScoring["red-team"] || [])
    .map((entry) => ({
      playerId: entry.playerId,
      name: entry.username ?? entry.playerId.slice(0, 8),
      attack: entry.metrics["red-team:attack"] ?? 0,
      model: entry.model,
      gamesPlayed: entry.gamesPlayed,
    }))
    .filter((d) => d.attack > 0)
    .sort((a, b) => b.attack - a.attack);

  return (
      <section className="max-w-4xl mx-auto px-6 py-16">

        <div className="border-t border-black pt-10">
          <div className="flex items-top justify-between gap-6">
            <div className="flex flex-col gap-2 mb-4 sm:w-1/2">
              <h1 className="text-4xl font-black text-black" style={{ fontFamily: 'var(--font-jost), sans-serif' }}>
                {challenge.name}
                {challenge.url && (
                  <a href={challenge.url} target="_blank" rel="noopener noreferrer" className="ml-2 text-[#999] hover:text-black inline-block align-middle">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                      <path d="M12.232 4.232a2.5 2.5 0 0 1 3.536 3.536l-1.225 1.224a.75.75 0 0 0 1.061 1.06l1.224-1.224a4 4 0 0 0-5.656-5.656l-3 3a4 4 0 0 0 .225 5.865.75.75 0 0 0 .977-1.138 2.5 2.5 0 0 1-.142-3.667l3-3Z" />
                      <path d="M11.603 7.963a.75.75 0 0 0-.977 1.138 2.5 2.5 0 0 1 .142 3.667l-3 3a2.5 2.5 0 0 1-3.536-3.536l1.225-1.224a.75.75 0 0 0-1.061-1.06l-1.224 1.224a4 4 0 1 0 5.656 5.656l3-3a4 4 0 0 0-.225-5.865Z" />
                    </svg>
                  </a>
                )}
              </h1>
              <p className="text-base text-[#333]">
                {challenge.description}
              </p>
            </div>
            <div className="hidden sm:flex flex-col gap-2 mb-4 items-end">
              <Link href={`/challenges/${name}/new`} className="text-sm font-bold bg-black text-white px-4 py-2 border border-black hover:bg-white hover:text-black transition-colors text-center">
                Participate
              </Link>
            </div>
          </div>
          {challenge.authors && challenge.authors.length > 0 && (
            <p className="text-sm text-[#555] mb-4">
              By{" "}
              {challenge.authors.map((author, i) => (
                <span key={author.name}>
                  {i > 0 && (i === challenge.authors!.length - 1 ? " and " : ", ")}
                  <a href={author.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-black">{author.name}</a>
                </span>
              ))}
            </p>
          )}
          {challenge.tags && challenge.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-10">
              {challenge.tags.map((tag) => {
                const colors = tagColors[tag] || tagColors._default;
                return (
                  <span key={tag} className={`text-xs px-2 py-1 ${colors}`}>
                    {tag}
                  </span>
                );
              })}
            </div>
          )}
          <div className="sm:hidden mb-10">
            <Link href={`/challenges/${name}/new`} className="text-sm font-bold bg-black text-white px-4 py-2 border border-black hover:bg-white hover:text-black transition-colors text-center inline-block">
              Participate
            </Link>
          </div>
        </div>

        <ChallengePrompt prompt={challenge.prompt} />

        {/* Graph + Stats */}
        {(() => {
          const unbeaten = scoringData.filter((d) => d.securityPolicy === 1).sort((a, b) => b.utility - a.utility);
          const hasGraph = scoringData.length > 0;
          const hasTables = unbeaten.length > 0 || redTeamData.length > 0;
          if (!hasGraph && !hasTables) return null;
          return (
            <div className="mt-6 mb-10 grid grid-cols-1 md:grid-cols-3 gap-6">
              {hasGraph && (
                <div className="border border-black self-start md:col-span-2 divide-y divide-[#eee]">
                  <div className="px-4 pt-4 pb-2">
                    <h2 className="text-sm font-black text-black" style={{ fontFamily: 'var(--font-jost), sans-serif' }}>Leaderboard</h2>
                    <p className="text-xs text-[#777] mt-1">Average security vs utility scores for this challenge.</p>
                  </div>
                  <div className="p-4">
                    <LeaderboardGraph data={scoringData} height={300} />
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-6">
                {unbeaten.length > 0 && (
                  <div className="border border-black self-start w-full divide-y divide-[#eee]">
                    <div className="px-4 pt-4 pb-2">
                      <h2 className="text-sm font-black text-black flex items-center gap-1.5" style={{ fontFamily: 'var(--font-jost), sans-serif' }}>Unbeaten <ShieldCheckIcon className="w-3.5 h-3.5 text-[#555]" /></h2>
                      <p className="text-xs text-[#777] mt-1">Never breached, ranked by utility.</p>
                    </div>
                    <div className="divide-y divide-[#eee]">
                      {unbeaten.map((player, i) => (
                        <div key={player.name} className="flex items-center px-4 py-1.5">
                          <span className="w-[20px] text-xs text-[#777] shrink-0">{i + 1}</span>
                          <span className="text-xs text-black min-w-0 flex-1 truncate"><Link href={`/users/${player.playerId}`} className="hover:underline">{player.name}</Link>{player.model && <span className="text-[#777] text-xs ml-1">({player.model})</span>}</span>
                          <span className="text-xs font-mono text-[#555] shrink-0 pl-3">{player.utility.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {redTeamData.length > 0 && (
                  <div className="border border-black self-start w-full divide-y divide-[#eee]">
                    <div className="px-4 pt-4 pb-2">
                      <h2 className="text-sm font-black text-black flex items-center gap-1.5" style={{ fontFamily: 'var(--font-jost), sans-serif' }}>Top Attackers <FireIcon className="w-3.5 h-3.5 text-[#333]" /></h2>
                      <p className="text-xs text-[#777] mt-1">Percentage of successful attacks.</p>
                    </div>
                    <div className="divide-y divide-[#eee]">
                      {redTeamData.map((player, i) => (
                        <div key={player.name} className="flex items-center px-4 py-1.5">
                          <span className="w-[20px] text-xs text-[#777] shrink-0">{i + 1}</span>
                          <span className="text-xs text-black min-w-0 flex-1 truncate"><Link href={`/users/${player.playerId}`} className="hover:underline">{player.name}</Link>{player.model && <span className="text-[#777] text-xs ml-1">({player.model})</span>}</span>
                          <span className="text-xs font-mono text-[#555] shrink-0 pl-3">{(player.attack * 100).toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Challenges List */}
        <ChallengesList
          challenges={challengesList}
          challengeType={name}
          profiles={profiles}
          total={challengesTotal}
          page={page}
          pageSize={pageSize}
          basePath={`/challenges/${name}`}
          subtitle={
            <p className="text-sm text-[#555] flex gap-4">
              <span><span className="font-black text-black">{challengesTotal.toLocaleString()}</span> Games</span>
              {scoringData.length > 0 && <span><span className="font-black text-black">{scoringData.length}</span> Participants</span>}
              {stats?.challenges?.[name]?.gamesPlayed > 0 && <span><span className="font-black text-black">{stats.challenges[name].gamesPlayed.toLocaleString()}</span> Completed</span>}
            </p>
          }
        />
      </section>
  );
}
