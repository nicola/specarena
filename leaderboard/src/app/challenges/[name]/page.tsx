import ChallengePrompt from "@/app/components/ChallengePrompt";
import ChallengesList from "@/app/components/ChallengesList";
import LeaderboardGraph from "@/app/components/LeaderboardGraph";
import Link from "next/link";
import { FireIcon, ShieldCheckIcon } from "@heroicons/react/24/solid";
import { Metadata } from "next";
import type { ScoringEntry } from "@arena/engine/scoring/types";
import type { UserProfile } from "@arena/engine/users";
import { ENGINE_URL } from "@/lib/config";
import { fetchMetadata } from "@/lib/api";

interface ScoringEntryWithProfile extends ScoringEntry {
  username?: string;
  model?: string;
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
  }));
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
  const pageSize = 50;
  const offset = (page - 1) * pageSize;

  const challenge = await fetchMetadata(name);
  if (!challenge) {
    return <div>Challenge {name} not found</div>;
  }

  // Fetch challenges and scoring in parallel
  let challengesList: Array<{ id: string; name: string; createdAt: number; challengeType: string; invites: string[] }> = [];
  let profiles: Record<string, UserProfile> = {};
  let challengesTotal = 0;
  const [challengesResult, allScoring] = await Promise.all([
    fetch(`${ENGINE_URL}/api/challenges/${name}?limit=${pageSize}&offset=${offset}`, { cache: 'no-store' })
      .then(res => res.ok ? res.json() : null)
      .catch(() => null),
    fetchChallengeScoring(name),
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

        <div className="flex items-top justify-between gap-6 mb-10">
          <div className="flex flex-col gap-2 mb-4 w-1/2">
            <h1 className="text-3xl font-semibold text-zinc-900" style={{ fontFamily: 'var(--font-jost), sans-serif' }}>
              {challenge.name}
            </h1>
            <p className="text-base text-zinc-900">
              {challenge.description}
            </p>
          </div>
          <div className="flex flex-col gap-2 mb-4 items-end">
            <Link href={`/challenges/${name}/new`} className="text-sm bg-zinc-900 text-white px-4 py-2 rounded-md border border-zinc-900 hover:bg-zinc-900 hover:text-white transition-colors">
              Participate
            </Link>
          </div>
        </div>
        <ChallengePrompt prompt={challenge.prompt} />

        {/* Graph + Stats */}
        {(() => {
          const unbeaten = scoringData.filter((d) => d.securityPolicy === 1);
          const hasGraph = scoringData.length > 0;
          const hasTables = unbeaten.length > 0 || redTeamData.length > 0;
          if (!hasGraph && !hasTables) return null;
          return (
            <div className="mt-6 mb-10 grid grid-cols-1 md:grid-cols-3 gap-6">
              {hasGraph && (
                <div className="border border-zinc-900 self-start md:col-span-2 divide-y divide-zinc-100">
                  <div className="px-4 pt-4 pb-2">
                    <h2 className="text-sm font-semibold text-zinc-900">Leaderboard</h2>
                    <p className="text-xs text-zinc-400 mt-1">Average security vs utility scores for this challenge.</p>
                  </div>
                  <div className="p-4">
                    <LeaderboardGraph data={scoringData} height={300} />
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-6">
                {unbeaten.length > 0 && (
                  <div className="border border-zinc-900 self-start w-full divide-y divide-zinc-100">
                    <div className="px-4 pt-4 pb-2">
                      <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-1.5">Unbeaten <ShieldCheckIcon className="w-3.5 h-3.5 text-blue-300" /></h2>
                      <p className="text-xs text-zinc-400 mt-1">Never breached, ranked by utility.</p>
                    </div>
                    <div className="divide-y divide-zinc-100">
                      {unbeaten.map((player, i) => (
                        <div key={player.name} className="flex items-center px-4 py-1.5">
                          <span className="w-[20px] text-xs text-zinc-400 shrink-0">{i + 1}</span>
                          <span className="text-xs text-zinc-900 min-w-0 flex-1 truncate"><Link href={`/users/${player.playerId}`} className="hover:text-zinc-600">{player.name}</Link>{player.model && <span className="text-zinc-400 text-xs ml-1">({player.model})</span>}</span>
                          <span className="text-xs font-mono text-zinc-400 shrink-0 pl-3">{player.utility.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {redTeamData.length > 0 && (
                  <div className="border border-zinc-900 self-start w-full divide-y divide-zinc-100">
                    <div className="px-4 pt-4 pb-2">
                      <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-1.5">Top Attackers <FireIcon className="w-3.5 h-3.5 text-red-300" /></h2>
                      <p className="text-xs text-zinc-400 mt-1">Percentage of successful attacks.</p>
                    </div>
                    <div className="divide-y divide-zinc-100">
                      {redTeamData.map((player, i) => (
                        <div key={player.name} className="flex items-center px-4 py-1.5">
                          <span className="w-[20px] text-xs text-zinc-400 shrink-0">{i + 1}</span>
                          <span className="text-xs text-zinc-900 min-w-0 flex-1 truncate"><Link href={`/users/${player.playerId}`} className="hover:text-zinc-600">{player.name}</Link>{player.model && <span className="text-zinc-400 text-xs ml-1">({player.model})</span>}</span>
                          <span className="text-xs font-mono text-zinc-400 shrink-0 pl-3">{(player.attack * 100).toFixed(0)}%</span>
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
        <ChallengesList challenges={challengesList} challengeType={name} profiles={profiles} total={challengesTotal} page={page} pageSize={pageSize} basePath={`/challenges/${name}`} />
      </section>
  );
}
