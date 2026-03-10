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
    <section className="max-w-5xl mx-auto px-6 py-12">
      {/* Challenge header */}
      <div className="flex items-start justify-between gap-6 mb-6">
        <div className="flex flex-col gap-2 sm:w-2/3">
          <h1
            className="text-3xl font-medium"
            style={{ color: 'var(--on-surface)', fontFamily: 'var(--font-google-sans), Roboto, sans-serif' }}
          >
            {challenge.name}
            {challenge.url && (
              <a href={challenge.url} target="_blank" rel="noopener noreferrer" className="ml-2 inline-block align-middle" style={{ color: 'var(--outline)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path d="M12.232 4.232a2.5 2.5 0 0 1 3.536 3.536l-1.225 1.224a.75.75 0 0 0 1.061 1.06l1.224-1.224a4 4 0 0 0-5.656-5.656l-3 3a4 4 0 0 0 .225 5.865.75.75 0 0 0 .977-1.138 2.5 2.5 0 0 1-.142-3.667l3-3Z" />
                  <path d="M11.603 7.963a.75.75 0 0 0-.977 1.138 2.5 2.5 0 0 1 .142 3.667l-3 3a2.5 2.5 0 0 1-3.536-3.536l1.225-1.224a.75.75 0 0 0-1.061-1.06l-1.224 1.224a4 4 0 1 0 5.656 5.656l3-3a4 4 0 0 0-.225-5.865Z" />
                </svg>
              </a>
            )}
          </h1>
          <p className="text-base" style={{ color: 'var(--on-surface-variant)', lineHeight: 1.6 }}>
            {challenge.description}
          </p>
          {challenge.authors && challenge.authors.length > 0 && (
            <p className="text-sm" style={{ color: 'var(--on-surface-variant)' }}>
              By{" "}
              {challenge.authors.map((author, i) => (
                <span key={author.name}>
                  {i > 0 && (i === challenge.authors!.length - 1 ? " and " : ", ")}
                  <a href={author.url} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--primary)' }}>{author.name}</a>
                </span>
              ))}
            </p>
          )}
          {challenge.tags && challenge.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-1">
              {challenge.tags.map((tag) => {
                const colors = tagColors[tag] || tagColors._default;
                return (
                  <span key={tag} className={`text-xs px-2.5 py-1 font-medium ${colors}`} style={{ borderRadius: '8px' }}>
                    {tag}
                  </span>
                );
              })}
            </div>
          )}
        </div>
        <div className="hidden sm:flex flex-col gap-2 items-end shrink-0">
          <Link
            href={`/challenges/${name}/new`}
            style={{
              background: 'var(--primary)',
              color: 'var(--on-primary)',
              borderRadius: '20px',
              padding: '10px 24px',
              fontWeight: 500,
              fontSize: '0.875rem',
              display: 'inline-flex',
              alignItems: 'center',
              boxShadow: 'var(--elevation-1)',
              textDecoration: 'none',
            }}
          >
            Participate
          </Link>
        </div>
      </div>

      {/* Mobile participate button */}
      <div className="sm:hidden mb-8">
        <Link
          href={`/challenges/${name}/new`}
          style={{
            background: 'var(--primary)',
            color: 'var(--on-primary)',
            borderRadius: '20px',
            padding: '10px 24px',
            fontWeight: 500,
            fontSize: '0.875rem',
            display: 'inline-flex',
            alignItems: 'center',
            boxShadow: 'var(--elevation-1)',
            textDecoration: 'none',
          }}
        >
          Participate
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
          <div className="mt-6 mb-10 grid grid-cols-1 md:grid-cols-3 gap-5">
            {hasGraph && (
              <div
                className="self-start md:col-span-2"
                style={{
                  borderRadius: '12px',
                  border: '1px solid var(--outline-variant)',
                  background: 'var(--surface)',
                  boxShadow: 'var(--elevation-1)',
                  overflow: 'hidden',
                }}
              >
                <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--outline-variant)', background: 'var(--surface-variant)' }}>
                  <h2 className="text-sm font-medium uppercase tracking-wider" style={{ color: 'var(--on-surface-variant)' }}>Leaderboard</h2>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--on-surface-variant)' }}>Average security vs utility scores for this challenge.</p>
                </div>
                <div className="p-4">
                  <LeaderboardGraph data={scoringData} height={300} />
                </div>
              </div>
            )}
            <div className="flex flex-col gap-5">
              {unbeaten.length > 0 && (
                <div
                  className="self-start w-full"
                  style={{
                    borderRadius: '12px',
                    border: '1px solid var(--outline-variant)',
                    background: 'var(--surface)',
                    boxShadow: 'var(--elevation-1)',
                    overflow: 'hidden',
                  }}
                >
                  <div className="px-4 pt-4 pb-2" style={{ borderBottom: '1px solid var(--outline-variant)', background: 'var(--surface-variant)' }}>
                    <h2 className="text-sm font-medium flex items-center gap-1.5" style={{ color: 'var(--on-surface)' }}>Unbeaten <ShieldCheckIcon className="w-3.5 h-3.5" style={{ color: '#1565c0' }} /></h2>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--on-surface-variant)' }}>Never breached, ranked by utility.</p>
                  </div>
                  <div>
                    {unbeaten.map((player, i) => (
                      <div key={player.name} className="flex items-center px-4 py-2" style={{ borderTop: i > 0 ? '1px solid var(--outline-variant)' : undefined }}>
                        <span className="w-[20px] text-xs shrink-0" style={{ color: 'var(--on-surface-variant)' }}>{i + 1}</span>
                        <span className="text-xs min-w-0 flex-1 truncate" style={{ color: 'var(--on-surface)' }}>
                          <Link href={`/users/${player.playerId}`} className="hover:underline" style={{ color: 'var(--primary)' }}>{player.name}</Link>
                          {player.model && <span className="text-xs ml-1" style={{ color: 'var(--on-surface-variant)' }}>({player.model})</span>}
                        </span>
                        <span className="text-xs font-mono shrink-0 pl-3" style={{ color: 'var(--on-surface-variant)' }}>{player.utility.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {redTeamData.length > 0 && (
                <div
                  className="self-start w-full"
                  style={{
                    borderRadius: '12px',
                    border: '1px solid var(--outline-variant)',
                    background: 'var(--surface)',
                    boxShadow: 'var(--elevation-1)',
                    overflow: 'hidden',
                  }}
                >
                  <div className="px-4 pt-4 pb-2" style={{ borderBottom: '1px solid var(--outline-variant)', background: 'var(--surface-variant)' }}>
                    <h2 className="text-sm font-medium flex items-center gap-1.5" style={{ color: 'var(--on-surface)' }}>Top Attackers <FireIcon className="w-3.5 h-3.5" style={{ color: '#c62828' }} /></h2>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--on-surface-variant)' }}>Percentage of successful attacks.</p>
                  </div>
                  <div>
                    {redTeamData.map((player, i) => (
                      <div key={player.name} className="flex items-center px-4 py-2" style={{ borderTop: i > 0 ? '1px solid var(--outline-variant)' : undefined }}>
                        <span className="w-[20px] text-xs shrink-0" style={{ color: 'var(--on-surface-variant)' }}>{i + 1}</span>
                        <span className="text-xs min-w-0 flex-1 truncate" style={{ color: 'var(--on-surface)' }}>
                          <Link href={`/users/${player.playerId}`} className="hover:underline" style={{ color: 'var(--primary)' }}>{player.name}</Link>
                          {player.model && <span className="text-xs ml-1" style={{ color: 'var(--on-surface-variant)' }}>({player.model})</span>}
                        </span>
                        <span className="text-xs font-mono shrink-0 pl-3" style={{ color: 'var(--on-surface-variant)' }}>{(player.attack * 100).toFixed(0)}%</span>
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
          <div className="flex gap-4 flex-wrap">
            {[
              { value: challengesTotal.toLocaleString(), label: 'Games' },
              scoringData.length > 0 && { value: scoringData.length, label: 'Participants' },
              stats?.challenges?.[name]?.gamesPlayed > 0 && { value: stats.challenges[name].gamesPlayed.toLocaleString(), label: 'Completed' },
            ].filter(Boolean).map((item) => item && (
              <span key={item.label} className="text-sm" style={{ color: 'var(--on-surface-variant)' }}>
                <span className="font-semibold" style={{ color: 'var(--on-surface)' }}>{item.value}</span> {item.label}
              </span>
            ))}
          </div>
        }
      />
    </section>
  );
}
