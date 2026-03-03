import ChallengePrompt from "@/app/components/ChallengePrompt";
import ChallengesList from "@/app/components/ChallengesList";
import LeaderboardGraph from "@/app/components/LeaderboardGraph";
import Link from "next/link";
import { Metadata } from "next";
import { ChallengeMetadata } from "@arena/engine/types";
import type { UserProfile } from "@arena/engine/users";
import { ENGINE_URL } from "@/lib/config";

interface ScoringEntry {
  playerId: string;
  gamesPlayed: number;
  metrics: Record<string, number>;
  username?: string;
  model?: string;
}

async function fetchChallengeScoring(challengeType: string): Promise<Record<string, ScoringEntry[]>> {
  try {
    const res = await fetch(`${ENGINE_URL}/api/scoring/${challengeType}`, { cache: "no-store" });
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

function graphDataFromScoring(data: Record<string, ScoringEntry[]>) {
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

export default async function ChallengePage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;

  const challenge = await fetchMetadata(name);
  if (!challenge) {
    return <div>Challenge {name} not found</div>;
  }

  // Fetch challenges and scoring in parallel
  let challengesList: Array<{ id: string; name: string; createdAt: number; challengeType: string; invites: string[] }> = [];
  let profiles: Record<string, UserProfile> = {};
  const [challengesResult, allScoring] = await Promise.all([
    fetch(`${ENGINE_URL}/api/challenges/${name}`, { cache: 'no-store' })
      .then(res => res.ok ? res.json() : null)
      .catch(() => null),
    fetchChallengeScoring(name),
  ]);
  if (challengesResult) {
    challengesList = challengesResult.challenges || [];
    profiles = challengesResult.profiles || {};
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
    <>
      {/* Hero Section */}
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ChallengePrompt prompt={challenge.prompt} />
          {scoringData.length > 0 && (
            <div className="border border-zinc-900 p-4 self-start">
              <LeaderboardGraph data={scoringData} height={300} />
            </div>
          )}
        </div>

        {/* Unbeaten + Red Team */}
        {(() => {
          const unbeaten = scoringData.filter((d) => d.securityPolicy === 1);
          if (unbeaten.length === 0 && redTeamData.length === 0) return null;
          return (
            <div className="mt-6 mb-10 grid grid-cols-1 md:grid-cols-2 gap-6">
              {unbeaten.length > 0 && (
                <div className="border border-zinc-900 self-start divide-y divide-zinc-100">
                  <h2 className="text-lg font-semibold text-zinc-900 px-8 pt-8 pb-4">
                    Unbeaten
                  </h2>
                  <div className="divide-y divide-zinc-100">
                    <div className="flex items-center px-8 py-3 text-xs text-zinc-400 uppercase tracking-wider border-b border-zinc-200">
                      <span className="min-w-0 flex-1">Player</span>
                      <span className="shrink-0 pl-3 text-right">Utility</span>
                    </div>
                    {unbeaten.map((player) => (
                      <div key={player.name} className="flex items-center px-8 py-3">
                        <span className="text-sm text-zinc-900 min-w-0 flex-1 truncate"><Link href={`/users/${player.playerId}`} className="hover:text-zinc-600">{player.name}</Link>{player.model && <span className="text-zinc-400 text-xs ml-1">({player.model})</span>}</span>
                        <span className="text-xs font-mono text-zinc-400 shrink-0 pl-3">{player.utility.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {redTeamData.length > 0 && (
                <div className="border border-zinc-900 self-start divide-y divide-zinc-100">
                  <h2 className="text-lg font-semibold text-zinc-900 px-8 pt-8 pb-4">
                    Red Team
                  </h2>
                  <div className="divide-y divide-zinc-100">
                    <div className="flex items-center px-8 py-3 text-xs text-zinc-400 uppercase tracking-wider border-b border-zinc-200">
                      <span className="w-[24px] shrink-0">#</span>
                      <span className="min-w-0 flex-1">Player</span>
                      <span className="shrink-0 pl-3 text-right">Attack</span>
                    </div>
                    {redTeamData.map((player, i) => (
                      <div key={player.name} className="flex items-center px-8 py-3">
                        <span className="w-[20px] text-xs text-zinc-400 shrink-0">{i + 1}</span>
                        <span className="text-sm text-zinc-900 min-w-0 flex-1 truncate"><Link href={`/users/${player.playerId}`} className="hover:text-zinc-600">{player.name}</Link>{player.model && <span className="text-zinc-400 text-xs ml-1">({player.model})</span>}</span>
                        <span className="text-xs font-mono text-zinc-400 shrink-0 pl-3">{player.attack.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Challenges List */}
        <ChallengesList challenges={challengesList} challengeType={name} profiles={profiles} />
      </section>
    </>
  );
}
