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
    return (
      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="border-4 border-black p-8" style={{ boxShadow: '6px 6px 0 #000' }}>
          <p className="text-xl font-black uppercase">Challenge {name} not found</p>
        </div>
      </section>
    );
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

      {/* Header */}
      <div className="flex items-start justify-between gap-6 mb-4">
        <div className="flex flex-col gap-3 sm:w-1/2">
          <h1 className="text-5xl font-black uppercase tracking-tight leading-none" style={{ fontFamily: "'Arial Black', Arial, sans-serif" }}>
            {challenge.name}
            {challenge.url && (
              <a href={challenge.url} target="_blank" rel="noopener noreferrer" className="ml-3 inline-block align-middle" style={{ color: '#ff0000' }}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6">
                  <path d="M12.232 4.232a2.5 2.5 0 0 1 3.536 3.536l-1.225 1.224a.75.75 0 0 0 1.061 1.06l1.224-1.224a4 4 0 0 0-5.656-5.656l-3 3a4 4 0 0 0 .225 5.865.75.75 0 0 0 .977-1.138 2.5 2.5 0 0 1-.142-3.667l3-3Z" />
                  <path d="M11.603 7.963a.75.75 0 0 0-.977 1.138 2.5 2.5 0 0 1 .142 3.667l-3 3a2.5 2.5 0 0 1-3.536-3.536l1.225-1.224a.75.75 0 0 0-1.061-1.06l-1.224 1.224a4 4 0 1 0 5.656 5.656l3-3a4 4 0 0 0-.225-5.865Z" />
                </svg>
              </a>
            )}
          </h1>
          <p className="text-base font-bold text-black">
            {challenge.description}
          </p>
        </div>
        <div className="hidden sm:flex flex-col gap-2 items-end">
          <Link
            href={`/challenges/${name}/new`}
            className="brutal-btn"
          >
            PARTICIPATE →
          </Link>
        </div>
      </div>

      {/* Authors */}
      {challenge.authors && challenge.authors.length > 0 && (
        <p className="text-sm font-bold uppercase tracking-wide mb-4">
          BY{" "}
          {challenge.authors.map((author, i) => (
            <span key={author.name}>
              {i > 0 && (i === challenge.authors!.length - 1 ? " AND " : ", ")}
              <a href={author.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-red-600">{author.name}</a>
            </span>
          ))}
        </p>
      )}

      {/* Tags */}
      {challenge.tags && challenge.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-8">
          {challenge.tags.map((tag) => (
            <span key={tag} className="brutal-tag">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Mobile participate button */}
      <div className="sm:hidden mb-8">
        <Link href={`/challenges/${name}/new`} className="brutal-btn">
          PARTICIPATE →
        </Link>
      </div>

      <ChallengePrompt prompt={challenge.prompt} />

      {/* Graph + Stats */}
      {(() => {
        const unbeaten = scoringData.filter((d) => d.securityPolicy === 1).sort((a, b) => b.utility - a.utility);
        const hasGraph = scoringData.length > 0;
        const hasTables = unbeaten.length > 0 || redTeamData.length > 0;
        if (!hasGraph && !hasTables) return null;
        return (
          <div className="mt-8 mb-10 grid grid-cols-1 md:grid-cols-3 gap-6">
            {hasGraph && (
              <div className="self-start md:col-span-2 border-4 border-black" style={{ boxShadow: '6px 6px 0 #000' }}>
                <div className="px-4 pt-4 pb-2 border-b-4 border-black bg-black text-white">
                  <h2 className="text-sm font-black uppercase tracking-widest">LEADERBOARD</h2>
                  <p className="text-xs font-bold mt-1 text-gray-300">AVERAGE SECURITY VS UTILITY SCORES.</p>
                </div>
                <div className="p-4">
                  <LeaderboardGraph data={scoringData} height={300} />
                </div>
              </div>
            )}
            <div className="flex flex-col gap-6">
              {unbeaten.length > 0 && (
                <div className="self-start w-full border-4 border-black" style={{ boxShadow: '6px 6px 0 #000' }}>
                  <div className="px-4 pt-4 pb-2 border-b-4 border-black bg-black text-white">
                    <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-1.5">UNBEATEN <ShieldCheckIcon className="w-3.5 h-3.5" /></h2>
                    <p className="text-xs font-bold mt-1 text-gray-300">NEVER BREACHED. RANKED BY UTILITY.</p>
                  </div>
                  <div className="divide-y-2 divide-black">
                    {unbeaten.map((player, i) => (
                      <div key={player.name} className="flex items-center px-4 py-2">
                        <span className="w-[20px] text-xs font-black shrink-0">{i + 1}</span>
                        <span className="text-xs font-bold min-w-0 flex-1 truncate uppercase">
                          <Link href={`/users/${player.playerId}`} className="hover:text-red-600">{player.name}</Link>
                          {player.model && <span className="text-gray-500 text-xs ml-1">({player.model})</span>}
                        </span>
                        <span className="text-xs font-mono font-black shrink-0 pl-3">{player.utility.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {redTeamData.length > 0 && (
                <div className="self-start w-full border-4 border-black" style={{ boxShadow: '6px 6px 0 #000' }}>
                  <div className="px-4 pt-4 pb-2 border-b-4 border-black" style={{ background: '#ff0000' }}>
                    <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-1.5">TOP ATTACKERS <FireIcon className="w-3.5 h-3.5" /></h2>
                    <p className="text-xs font-bold mt-1">% SUCCESSFUL ATTACKS.</p>
                  </div>
                  <div className="divide-y-2 divide-black">
                    {redTeamData.map((player, i) => (
                      <div key={player.name} className="flex items-center px-4 py-2">
                        <span className="w-[20px] text-xs font-black shrink-0">{i + 1}</span>
                        <span className="text-xs font-bold min-w-0 flex-1 truncate uppercase">
                          <Link href={`/users/${player.playerId}`} className="hover:text-red-600">{player.name}</Link>
                          {player.model && <span className="text-gray-500 text-xs ml-1">({player.model})</span>}
                        </span>
                        <span className="text-xs font-mono font-black shrink-0 pl-3">{(player.attack * 100).toFixed(0)}%</span>
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
          <p className="text-sm font-black uppercase tracking-wide flex gap-6">
            <span><span className="text-red-600">{challengesTotal.toLocaleString()}</span> GAMES</span>
            {scoringData.length > 0 && <span><span className="text-red-600">{scoringData.length}</span> PARTICIPANTS</span>}
            {stats?.challenges?.[name]?.gamesPlayed > 0 && <span><span className="text-red-600">{stats.challenges[name].gamesPlayed.toLocaleString()}</span> COMPLETED</span>}
          </p>
        }
      />
    </section>
  );
}
