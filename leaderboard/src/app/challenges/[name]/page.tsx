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

const inkPanel = {
  background: '#faf6ef',
  border: '1px solid #d4c4a8',
  boxShadow: 'inset 0 1px 3px rgba(26,16,8,0.06)',
} as const;

export default async function ChallengePage({ params, searchParams }: { params: Promise<{ name: string }>; searchParams: Promise<{ page?: string }> }) {
  const { name } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam || "1", 10) || 1);
  const pageSize = 10;
  const offset = (page - 1) * pageSize;

  const challenge = await fetchMetadata(name);
  if (!challenge) {
    return <div style={{ color: '#1a1008', padding: '2rem' }}>Challenge {name} not found</div>;
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
    <section className="max-w-4xl mx-auto px-6 py-16">
      <div className="flex items-top justify-between gap-6">
        <div className="flex flex-col gap-2 mb-4 sm:w-1/2">
          {/* Red accent line above title */}
          <div style={{ width: 40, height: 2, background: '#cc2200', opacity: 0.8, marginBottom: 4 }} />
          <h1
            className="text-3xl font-semibold"
            style={{ fontFamily: 'var(--font-noto-serif), serif', color: '#1a1008', letterSpacing: '0.03em' }}
          >
            {challenge.name}
            {challenge.url && (
              <a href={challenge.url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 8, color: '#b8997a', display: 'inline-block', verticalAlign: 'middle' }}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style={{ width: 20, height: 20 }}>
                  <path d="M12.232 4.232a2.5 2.5 0 0 1 3.536 3.536l-1.225 1.224a.75.75 0 0 0 1.061 1.06l1.224-1.224a4 4 0 0 0-5.656-5.656l-3 3a4 4 0 0 0 .225 5.865.75.75 0 0 0 .977-1.138 2.5 2.5 0 0 1-.142-3.667l3-3Z" />
                  <path d="M11.603 7.963a.75.75 0 0 0-.977 1.138 2.5 2.5 0 0 1 .142 3.667l-3 3a2.5 2.5 0 0 1-3.536-3.536l1.225-1.224a.75.75 0 0 0-1.061-1.06l-1.224 1.224a4 4 0 1 0 5.656 5.656l3-3a4 4 0 0 0-.225-5.865Z" />
                </svg>
              </a>
            )}
          </h1>
          <p className="text-base" style={{ color: '#5a4030', lineHeight: 1.7 }}>
            {challenge.description}
          </p>
        </div>
        <div className="hidden sm:flex flex-col gap-2 mb-4 items-end">
          <Link
            href={`/challenges/${name}/new`}
            className="text-sm text-center transition-colors"
            style={{
              padding: '8px 20px',
              background: '#cc2200',
              color: '#faf6ef',
              border: '1px solid #cc2200',
              fontFamily: 'var(--font-noto-sans)',
              letterSpacing: '0.05em',
              textDecoration: 'none',
            }}
          >
            Participate
          </Link>
        </div>
      </div>

      {challenge.authors && challenge.authors.length > 0 && (
        <p className="text-sm mb-4" style={{ color: '#8b4513' }}>
          By{" "}
          {challenge.authors.map((author, i) => (
            <span key={author.name}>
              {i > 0 && (i === challenge.authors!.length - 1 ? " and " : ", ")}
              <a href={author.url} target="_blank" rel="noopener noreferrer" style={{ color: '#cc2200', textDecoration: 'underline' }}>{author.name}</a>
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
        <Link
          href={`/challenges/${name}/new`}
          style={{
            display: 'inline-block',
            padding: '8px 20px',
            background: '#cc2200',
            color: '#faf6ef',
            border: '1px solid #cc2200',
            fontFamily: 'var(--font-noto-sans)',
            letterSpacing: '0.05em',
            textDecoration: 'none',
            fontSize: 14,
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
          <div className="mt-6 mb-10 grid grid-cols-1 md:grid-cols-3 gap-6">
            {hasGraph && (
              <div className="self-start md:col-span-2 divide-y" style={{ ...inkPanel, '--tw-divide-color': '#e8dcc8' } as React.CSSProperties}>
                <div className="px-4 pt-4 pb-2">
                  <h2 className="text-sm font-semibold" style={{ fontFamily: 'var(--font-noto-serif)', color: '#1a1008' }}>Leaderboard</h2>
                  <p className="text-xs mt-1" style={{ color: '#8b4513' }}>Average security vs utility scores for this challenge.</p>
                </div>
                <div className="p-4" style={{ borderTop: '1px solid #e8dcc8' }}>
                  <LeaderboardGraph data={scoringData} height={300} />
                </div>
              </div>
            )}
            <div className="flex flex-col gap-6">
              {unbeaten.length > 0 && (
                <div className="self-start w-full" style={inkPanel}>
                  <div className="px-4 pt-4 pb-2">
                    <h2 className="text-sm font-semibold flex items-center gap-1.5" style={{ fontFamily: 'var(--font-noto-serif)', color: '#1a1008' }}>
                      Unbeaten <ShieldCheckIcon className="w-3.5 h-3.5" style={{ color: '#4a7eb5' }} />
                    </h2>
                    <p className="text-xs mt-1" style={{ color: '#8b4513' }}>Never breached, ranked by utility.</p>
                  </div>
                  <div style={{ borderTop: '1px solid #e8dcc8' }}>
                    {unbeaten.map((player, i) => (
                      <div key={player.name} className="flex items-center px-4 py-1.5" style={{ borderBottom: '1px solid #e8dcc8' }}>
                        <span className="w-[20px] text-xs shrink-0" style={{ color: '#b8997a' }}>{i + 1}</span>
                        <span className="text-xs min-w-0 flex-1 truncate" style={{ color: '#1a1008', fontFamily: 'var(--font-noto-sans)' }}>
                          <Link href={`/users/${player.playerId}`} style={{ color: '#1a1008', textDecoration: 'none' }}>{player.name}</Link>
                          {player.model && <span style={{ color: '#b8997a', fontSize: 11 }}> ({player.model})</span>}
                        </span>
                        <span className="text-xs font-mono shrink-0 pl-3" style={{ color: '#8b4513' }}>{player.utility.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {redTeamData.length > 0 && (
                <div className="self-start w-full" style={inkPanel}>
                  <div className="px-4 pt-4 pb-2">
                    <h2 className="text-sm font-semibold flex items-center gap-1.5" style={{ fontFamily: 'var(--font-noto-serif)', color: '#1a1008' }}>
                      Top Attackers <FireIcon className="w-3.5 h-3.5" style={{ color: '#cc2200', opacity: 0.7 }} />
                    </h2>
                    <p className="text-xs mt-1" style={{ color: '#8b4513' }}>Percentage of successful attacks.</p>
                  </div>
                  <div style={{ borderTop: '1px solid #e8dcc8' }}>
                    {redTeamData.map((player, i) => (
                      <div key={player.name} className="flex items-center px-4 py-1.5" style={{ borderBottom: '1px solid #e8dcc8' }}>
                        <span className="w-[20px] text-xs shrink-0" style={{ color: '#b8997a' }}>{i + 1}</span>
                        <span className="text-xs min-w-0 flex-1 truncate" style={{ color: '#1a1008', fontFamily: 'var(--font-noto-sans)' }}>
                          <Link href={`/users/${player.playerId}`} style={{ color: '#1a1008', textDecoration: 'none' }}>{player.name}</Link>
                          {player.model && <span style={{ color: '#b8997a', fontSize: 11 }}> ({player.model})</span>}
                        </span>
                        <span className="text-xs font-mono shrink-0 pl-3" style={{ color: '#8b4513' }}>{(player.attack * 100).toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      <ChallengesList
        challenges={challengesList}
        challengeType={name}
        profiles={profiles}
        total={challengesTotal}
        page={page}
        pageSize={pageSize}
        basePath={`/challenges/${name}`}
        subtitle={
          <p className="text-sm flex gap-4" style={{ color: '#8b4513', fontFamily: 'var(--font-noto-sans)' }}>
            <span><span style={{ fontWeight: 600, color: '#1a1008' }}>{challengesTotal.toLocaleString()}</span> Games</span>
            {scoringData.length > 0 && <span><span style={{ fontWeight: 600, color: '#1a1008' }}>{scoringData.length}</span> Participants</span>}
            {stats?.challenges?.[name]?.gamesPlayed > 0 && <span><span style={{ fontWeight: 600, color: '#1a1008' }}>{stats.challenges[name].gamesPlayed.toLocaleString()}</span> Completed</span>}
          </p>
        }
      />
    </section>
  );
}
