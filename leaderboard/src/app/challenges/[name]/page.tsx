import ChallengePrompt from "@/app/components/ChallengePrompt";
import ChallengesList from "@/app/components/ChallengesList";
import LeaderboardGraph from "@/app/components/LeaderboardGraph";
import Link from "next/link";
import { Metadata } from "next";
import { ChallengeMetadata, type Challenge } from "@arena/engine/types";
import type { ScoringEntry } from "@arena/engine/scoring/types";
import type { UserProfile } from "@arena/engine/users";
import { ENGINE_URL } from "@/lib/config";

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
      <div className="font-mono text-[#00ff00] bg-black min-h-screen p-8">
        <span className="text-[#00ff00]">ERROR: </span>Challenge {name} not found
      </div>
    );
  }

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

  const now = new Date();
  const dateStr = now.toISOString().replace('T', ' ').slice(0, 19);

  return (
    <section className="max-w-4xl mx-auto px-4 py-8 font-mono text-[#00ff00] bg-black">

      {/* Man page header */}
      <div className="mb-6">
        <div className="flex justify-between text-[#00ff00] text-xs mb-1">
          <span>ARENA(1)</span>
          <span>ARENA CHALLENGE MANUAL</span>
          <span>ARENA(1)</span>
        </div>
        <div className="border border-[#00ff00] p-4">
          <div className="mb-3">
            <span className="text-[#00ff00] font-bold">NAME</span>
          </div>
          <div className="pl-8 mb-4">
            <span className="text-[#00ff00] font-bold text-xl">{challenge.name}</span>
            {challenge.url && (
              <a href={challenge.url} target="_blank" rel="noopener noreferrer" className="ml-3 text-[#00aa00] hover:text-[#00ff00] text-sm underline">
                [external-link]
              </a>
            )}
            <span className="text-[#00aa00] ml-3">- {challenge.description}</span>
          </div>

          {challenge.authors && challenge.authors.length > 0 && (
            <>
              <div className="mb-2">
                <span className="text-[#00ff00] font-bold">AUTHORS</span>
              </div>
              <div className="pl-8 mb-4 text-[#00aa00] text-sm">
                {challenge.authors.map((author, i) => (
                  <span key={author.name}>
                    {i > 0 && (i === challenge.authors!.length - 1 ? " and " : ", ")}
                    <a href={author.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-[#00ff00]">{author.name}</a>
                  </span>
                ))}
              </div>
            </>
          )}

          {challenge.tags && challenge.tags.length > 0 && (
            <>
              <div className="mb-2">
                <span className="text-[#00ff00] font-bold">TAGS</span>
              </div>
              <div className="pl-8 mb-4 flex flex-wrap gap-2">
                {challenge.tags.map((tag) => (
                  <span key={tag} className="text-xs border border-[#00ff00] px-2 py-0.5 text-[#00ff00]">
                    [{tag}]
                  </span>
                ))}
              </div>
            </>
          )}

          <div className="mb-2">
            <span className="text-[#00ff00] font-bold">SYNOPSIS</span>
          </div>
          <div className="pl-8 mb-4 text-sm text-[#00aa00]">
            <span className="text-[#00ff00]">arena participate</span> --challenge={name} [--invite=INVITE_CODE]
          </div>
        </div>

        <div className="mt-2 flex justify-end">
          <Link
            href={`/challenges/${name}/new`}
            className="border border-[#00ff00] text-[#00ff00] px-4 py-1 text-sm hover:bg-[#00ff00] hover:text-black transition-colors"
          >
            $ ./participate.sh
          </Link>
        </div>
      </div>

      {/* Prompt section */}
      <ChallengePrompt prompt={challenge.prompt} />

      {/* Leaderboard */}
      {(() => {
        const unbeaten = scoringData.filter((d) => d.securityPolicy === 1).sort((a, b) => b.utility - a.utility);
        const hasGraph = scoringData.length > 0;
        const hasTables = unbeaten.length > 0 || redTeamData.length > 0;
        if (!hasGraph && !hasTables) return null;
        return (
          <div className="mt-6 mb-8">
            <div className="text-[#00ff00] font-bold mb-3">LEADERBOARD</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {hasGraph && (
                <div className="border border-[#00ff00] self-start md:col-span-2">
                  <div className="border-b border-[#00ff00] px-3 py-2">
                    <span className="text-[#00ff00] text-xs font-bold">SECURITY vs UTILITY SCATTER</span>
                    <span className="text-[#00aa00] text-xs ml-3">-- avg scores for this challenge</span>
                  </div>
                  <div className="p-3">
                    <LeaderboardGraph data={scoringData} height={300} />
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-4">
                {unbeaten.length > 0 && (
                  <div className="border border-[#00ff00] self-start w-full">
                    <div className="border-b border-[#00ff00] px-3 py-2">
                      <span className="text-[#00ff00] text-xs font-bold">[UNBEATEN]</span>
                      <span className="text-[#00aa00] text-xs ml-2">-- security=1.00, by utility</span>
                    </div>
                    <div className="divide-y divide-[#003300]">
                      {unbeaten.map((player, i) => (
                        <div key={player.name} className="flex items-center px-3 py-1.5">
                          <span className="w-[24px] text-xs text-[#006600] shrink-0">{String(i + 1).padStart(2, '0')}.</span>
                          <span className="text-xs text-[#00ff00] min-w-0 flex-1 truncate">
                            <Link href={`/users/${player.playerId}`} className="hover:text-white">{player.name}</Link>
                            {player.model && <span className="text-[#006600] text-xs ml-1">({player.model})</span>}
                          </span>
                          <span className="text-xs font-mono text-[#00aa00] shrink-0 pl-3">{player.utility.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {redTeamData.length > 0 && (
                  <div className="border border-[#00ff00] self-start w-full">
                    <div className="border-b border-[#00ff00] px-3 py-2">
                      <span className="text-[#ff4444] text-xs font-bold">[TOP ATTACKERS]</span>
                      <span className="text-[#00aa00] text-xs ml-2">-- breach rate</span>
                    </div>
                    <div className="divide-y divide-[#003300]">
                      {redTeamData.map((player, i) => (
                        <div key={player.name} className="flex items-center px-3 py-1.5">
                          <span className="w-[24px] text-xs text-[#006600] shrink-0">{String(i + 1).padStart(2, '0')}.</span>
                          <span className="text-xs text-[#00ff00] min-w-0 flex-1 truncate">
                            <Link href={`/users/${player.playerId}`} className="hover:text-white">{player.name}</Link>
                            {player.model && <span className="text-[#006600] text-xs ml-1">({player.model})</span>}
                          </span>
                          <span className="text-xs font-mono text-[#ff4444] shrink-0 pl-3">{(player.attack * 100).toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
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
          <p className="text-xs text-[#00aa00] flex gap-4 font-mono">
            <span><span className="text-[#00ff00]">{challengesTotal.toLocaleString()}</span> games</span>
            {scoringData.length > 0 && <span><span className="text-[#00ff00]">{scoringData.length}</span> participants</span>}
            {stats?.challenges?.[name]?.gamesPlayed > 0 && <span><span className="text-[#00ff00]">{stats.challenges[name].gamesPlayed.toLocaleString()}</span> completed</span>}
          </p>
        }
      />

      <div className="mt-8 text-xs text-[#006600] border-t border-[#003300] pt-2">
        <span>-- generated {dateStr} UTC | ARENA Manual Page</span>
      </div>
    </section>
  );
}
