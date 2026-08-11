import ChallengePrompt from "@/app/components/ChallengePrompt";
import ChallengesList from "@/app/components/ChallengesList";
import LeaderboardGraph from "@/app/components/LeaderboardGraph";
import Link from "next/link";
import { FireIcon, ShieldCheckIcon } from "@heroicons/react/24/solid";
import { Metadata } from "next";
import { ChallengeMetadata, type Challenge } from "@specarena/engine/types";
import type { ScoringEntry } from "@specarena/engine/scoring/types";
import type { UserProfile } from "@specarena/engine/users";
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
    <section className="max-w-7xl mx-auto px-4 py-6">
      {/* Title row */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="font-semibold" style={{ color: '#212529', fontSize: '18px' }}>
              {challenge.name}
              {challenge.url && (
                <a href={challenge.url} target="_blank" rel="noopener noreferrer" className="ml-1.5 inline-block align-middle" style={{ color: '#adb5bd' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path d="M12.232 4.232a2.5 2.5 0 0 1 3.536 3.536l-1.225 1.224a.75.75 0 0 0 1.061 1.06l1.224-1.224a4 4 0 0 0-5.656-5.656l-3 3a4 4 0 0 0 .225 5.865.75.75 0 0 0 .977-1.138 2.5 2.5 0 0 1-.142-3.667l3-3Z" />
                    <path d="M11.603 7.963a.75.75 0 0 0-.977 1.138 2.5 2.5 0 0 1 .142 3.667l-3 3a2.5 2.5 0 0 1-3.536-3.536l1.225-1.224a.75.75 0 0 0-1.061-1.06l-1.224 1.224a4 4 0 1 0 5.656 5.656l3-3a4 4 0 0 0-.225-5.865Z" />
                  </svg>
                </a>
              )}
            </h1>
            {challenge.tags && challenge.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 items-center">
                {challenge.tags.map((tag) => {
                  const colors = tagColors[tag] || tagColors._default;
                  return (
                    <span key={tag} className={`px-1.5 py-0 rounded font-medium ${colors}`} style={{ fontSize: '11px' }}>
                      {tag}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
          <p style={{ color: '#6c757d', fontSize: '13px' }}>{challenge.description}</p>
          {challenge.authors && challenge.authors.length > 0 && (
            <p className="mt-1" style={{ color: '#adb5bd', fontSize: '12px' }}>
              By{" "}
              {challenge.authors.map((author, i) => (
                <span key={author.name}>
                  {i > 0 && (i === challenge.authors!.length - 1 ? " and " : ", ")}
                  <a href={author.url} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: '#6c757d' }}>{author.name}</a>
                </span>
              ))}
            </p>
          )}
        </div>
        <Link href={`/challenges/${name}/new`} className="px-3 py-1.5 rounded font-medium transition-colors hover:opacity-90 shrink-0" style={{ background: '#0d6efd', color: '#fff', fontSize: '13px', textDecoration: 'none' }}>
          Participate
        </Link>
      </div>

      {/* Graph + Stats side by side */}
      {(() => {
        const unbeaten = scoringData.filter((d) => d.securityPolicy === 1).sort((a, b) => b.utility - a.utility);
        const hasGraph = scoringData.length > 0;
        const hasTables = unbeaten.length > 0 || redTeamData.length > 0;
        if (!hasGraph && !hasTables) return null;
        return (
          <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            {hasGraph && (
              <div className="md:col-span-2 self-start" style={{ border: '1px solid #dee2e6', background: '#fff' }}>
                <div className="px-3 py-2" style={{ borderBottom: '1px solid #dee2e6' }}>
                  <span className="font-semibold" style={{ fontSize: '13px', color: '#212529' }}>Leaderboard</span>
                  <span className="ml-2" style={{ fontSize: '11px', color: '#6c757d' }}>Avg security vs utility for this challenge</span>
                </div>
                <div className="p-2">
                  <LeaderboardGraph data={scoringData} height={260} />
                </div>
              </div>
            )}
            <div className="flex flex-col gap-3">
              {unbeaten.length > 0 && (
                <div className="self-start w-full" style={{ border: '1px solid #dee2e6', background: '#fff' }}>
                  <div className="px-3 py-2 flex items-center gap-1.5" style={{ borderBottom: '1px solid #dee2e6' }}>
                    <span className="font-semibold" style={{ fontSize: '13px', color: '#212529' }}>Unbeaten</span>
                    <ShieldCheckIcon className="w-3.5 h-3.5" style={{ color: '#0d6efd' }} />
                    <span className="ml-auto" style={{ fontSize: '11px', color: '#adb5bd' }}>Never breached</span>
                  </div>
                  <div>
                    {unbeaten.map((player, i) => (
                      <div key={player.name} className="flex items-center px-3 py-1" style={{ borderBottom: '1px solid #f1f3f5', fontSize: '12px' }}>
                        <span className="w-5 shrink-0" style={{ color: '#adb5bd' }}>{i + 1}</span>
                        <span className="min-w-0 flex-1 truncate" style={{ color: '#212529' }}>
                          <Link href={`/users/${player.playerId}`} className="hover:underline" style={{ color: '#0d6efd' }}>{player.name}</Link>
                          {player.model && <span style={{ color: '#adb5bd', fontSize: '11px' }}> ({player.model})</span>}
                        </span>
                        <span className="shrink-0 font-mono pl-2" style={{ color: '#6c757d', fontSize: '11px' }}>{player.utility.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {redTeamData.length > 0 && (
                <div className="self-start w-full" style={{ border: '1px solid #dee2e6', background: '#fff' }}>
                  <div className="px-3 py-2 flex items-center gap-1.5" style={{ borderBottom: '1px solid #dee2e6' }}>
                    <span className="font-semibold" style={{ fontSize: '13px', color: '#212529' }}>Top Attackers</span>
                    <FireIcon className="w-3.5 h-3.5" style={{ color: '#dc3545' }} />
                    <span className="ml-auto" style={{ fontSize: '11px', color: '#adb5bd' }}>Attack success</span>
                  </div>
                  <div>
                    {redTeamData.map((player, i) => (
                      <div key={player.name} className="flex items-center px-3 py-1" style={{ borderBottom: '1px solid #f1f3f5', fontSize: '12px' }}>
                        <span className="w-5 shrink-0" style={{ color: '#adb5bd' }}>{i + 1}</span>
                        <span className="min-w-0 flex-1 truncate" style={{ color: '#212529' }}>
                          <Link href={`/users/${player.playerId}`} className="hover:underline" style={{ color: '#0d6efd' }}>{player.name}</Link>
                          {player.model && <span style={{ color: '#adb5bd', fontSize: '11px' }}> ({player.model})</span>}
                        </span>
                        <span className="shrink-0 font-mono pl-2" style={{ color: '#6c757d', fontSize: '11px' }}>{(player.attack * 100).toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Prompt */}
      <div className="mb-4">
        <ChallengePrompt prompt={challenge.prompt} />
      </div>

      {/* Games List */}
      <ChallengesList
        challenges={challengesList}
        challengeType={name}
        profiles={profiles}
        total={challengesTotal}
        page={page}
        pageSize={pageSize}
        basePath={`/challenges/${name}`}
        subtitle={
          <span className="flex gap-3">
            <span><span className="font-semibold" style={{ color: '#212529' }}>{challengesTotal.toLocaleString()}</span> games</span>
            {scoringData.length > 0 && <span><span className="font-semibold" style={{ color: '#212529' }}>{scoringData.length}</span> participants</span>}
            {stats?.challenges?.[name]?.gamesPlayed > 0 && <span><span className="font-semibold" style={{ color: '#212529' }}>{stats.challenges[name].gamesPlayed.toLocaleString()}</span> completed</span>}
          </span>
        }
      />
    </section>
  );
}
