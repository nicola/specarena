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
    title: challenge ? `ARENA — ${challenge.name}` : "ARENA — Challenge Not Found",
    description: challenge?.description || "",
  };
  return metadata;
}

const smallCapsLabel = {
  fontVariant: 'small-caps' as const,
  letterSpacing: '0.08em',
  fontSize: '0.7rem',
  color: '#555555',
  fontFamily: 'var(--font-lora), serif',
  fontWeight: 600,
};

export default async function ChallengePage({ params, searchParams }: { params: Promise<{ name: string }>; searchParams: Promise<{ page?: string }> }) {
  const { name } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam || "1", 10) || 1);
  const pageSize = 10;
  const offset = (page - 1) * pageSize;

  const challenge = await fetchMetadata(name);
  if (!challenge) {
    return <div style={{ fontFamily: 'var(--font-lora), serif', padding: '2rem' }}>Challenge {name} not found</div>;
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
    <section className="max-w-4xl mx-auto px-6 py-12">
      {/* Dateline */}
      <p className="dateline mb-3" style={{ fontFamily: 'var(--font-lora), serif' }}>
        March 2026 — {name.replace(/-/g, ' ').toUpperCase()}
      </p>

      {/* Challenge headline */}
      <div style={{ borderTop: '3px double #111111', paddingTop: '1rem', marginBottom: '1.25rem' }}>
        <div className="flex items-start justify-between gap-6">
          <div style={{ flex: 1 }}>
            <h1 style={{
              fontFamily: 'var(--font-playfair), serif',
              fontSize: '2.2rem',
              fontWeight: '800',
              color: '#111111',
              lineHeight: 1.15,
              marginBottom: '0.5rem',
            }}>
              {challenge.name}
              {challenge.url && (
                <a href={challenge.url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: '0.5rem', color: '#888', display: 'inline-block', verticalAlign: 'middle' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style={{ width: '1rem', height: '1rem' }}>
                    <path d="M12.232 4.232a2.5 2.5 0 0 1 3.536 3.536l-1.225 1.224a.75.75 0 0 0 1.061 1.06l1.224-1.224a4 4 0 0 0-5.656-5.656l-3 3a4 4 0 0 0 .225 5.865.75.75 0 0 0 .977-1.138 2.5 2.5 0 0 1-.142-3.667l3-3Z" />
                    <path d="M11.603 7.963a.75.75 0 0 0-.977 1.138 2.5 2.5 0 0 1 .142 3.667l-3 3a2.5 2.5 0 0 1-3.536-3.536l1.225-1.224a.75.75 0 0 0-1.061-1.06l-1.224 1.224a4 4 0 1 0 5.656 5.656l3-3a4 4 0 0 0-.225-5.865Z" />
                  </svg>
                </a>
              )}
            </h1>
            <p style={{ fontFamily: 'var(--font-lora), serif', fontSize: '1rem', fontStyle: 'italic', color: '#555', lineHeight: 1.5 }}>
              {challenge.description}
            </p>
          </div>
          <div className="hidden sm:block" style={{ flexShrink: 0 }}>
            <Link href={`/challenges/${name}/new`} style={{
              fontVariant: 'small-caps',
              letterSpacing: '0.08em',
              fontSize: '0.72rem',
              color: '#faf9f6',
              background: '#111111',
              fontFamily: 'var(--font-lora), serif',
              fontWeight: 700,
              textDecoration: 'none',
              padding: '0.5rem 1.2rem',
              display: 'inline-block',
            }}>
              Participate →
            </Link>
          </div>
        </div>
      </div>

      {/* Byline / authors + tags */}
      <div style={{ borderBottom: '1px solid #111', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>
        {challenge.authors && challenge.authors.length > 0 && (
          <p style={{ fontFamily: 'var(--font-lora), serif', fontSize: '0.78rem', color: '#555', marginBottom: '0.4rem' }}>
            By{" "}
            {challenge.authors.map((author, i) => (
              <span key={author.name}>
                {i > 0 && (i === challenge.authors!.length - 1 ? " and " : ", ")}
                <a href={author.url} target="_blank" rel="noopener noreferrer" style={{ color: '#111', textDecoration: 'underline' }}>{author.name}</a>
              </span>
            ))}
          </p>
        )}
        {challenge.tags && challenge.tags.length > 0 && (
          <p style={{ fontFamily: 'var(--font-lora), serif', fontSize: '0.72rem', color: '#8b0000', fontVariant: 'small-caps', letterSpacing: '0.07em' }}>
            {challenge.tags.join(' · ')}
          </p>
        )}
      </div>

      {/* Mobile participate */}
      <div className="sm:hidden" style={{ marginBottom: '1.5rem' }}>
        <Link href={`/challenges/${name}/new`} style={{
          fontVariant: 'small-caps',
          letterSpacing: '0.08em',
          fontSize: '0.72rem',
          color: '#faf9f6',
          background: '#111111',
          fontFamily: 'var(--font-lora), serif',
          fontWeight: 700,
          textDecoration: 'none',
          padding: '0.5rem 1.2rem',
          display: 'inline-block',
        }}>
          Participate →
        </Link>
      </div>

      {/* Prompt */}
      <div style={{ marginBottom: '2rem' }}>
        <ChallengePrompt prompt={challenge.prompt} />
      </div>

      {/* Graph + Stats */}
      {(() => {
        const unbeaten = scoringData.filter((d) => d.securityPolicy === 1).sort((a, b) => b.utility - a.utility);
        const hasGraph = scoringData.length > 0;
        const hasTables = unbeaten.length > 0 || redTeamData.length > 0;
        if (!hasGraph && !hasTables) return null;
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6" style={{ marginBottom: '2rem' }}>
            {hasGraph && (
              <div className="md:col-span-2 self-start" style={{ borderTop: '1px solid #111' }}>
                <div style={{ paddingTop: '0.75rem', paddingBottom: '0.5rem' }}>
                  <h2 style={{ ...smallCapsLabel, color: '#8b0000', fontSize: '0.7rem' }}>Challenge Leaderboard</h2>
                  <p style={{ fontFamily: 'var(--font-lora), serif', fontSize: '0.72rem', color: '#888', marginTop: '0.2rem' }}>Average security vs utility scores.</p>
                </div>
                <LeaderboardGraph data={scoringData} height={300} />
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {unbeaten.length > 0 && (
                <div style={{ borderTop: '1px solid #111' }}>
                  <div style={{ paddingTop: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid #ddd' }}>
                    <h2 style={{ ...smallCapsLabel, color: '#111', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      Unbeaten <ShieldCheckIcon style={{ width: '0.8rem', height: '0.8rem', color: '#555' }} />
                    </h2>
                    <p style={{ fontFamily: 'var(--font-lora), serif', fontSize: '0.7rem', color: '#888', marginTop: '0.2rem' }}>Never breached, ranked by utility.</p>
                  </div>
                  {unbeaten.map((player, i) => (
                    <div key={player.name} className="flex items-center px-0 py-1.5" style={{ borderBottom: '1px solid #eee' }}>
                      <span style={{ width: 20, fontSize: '0.7rem', color: '#888', fontFamily: 'monospace', flexShrink: 0 }}>{i + 1}</span>
                      <span style={{ fontFamily: 'var(--font-lora), serif', fontSize: '0.78rem', color: '#111', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <Link href={`/users/${player.playerId}`} style={{ color: '#111', textDecoration: 'none' }}>{player.name}</Link>
                        {player.model && <span style={{ color: '#888', fontSize: '0.7rem', marginLeft: '0.25rem' }}>({player.model})</span>}
                      </span>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#555', flexShrink: 0, paddingLeft: '0.75rem' }}>{player.utility.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
              {redTeamData.length > 0 && (
                <div style={{ borderTop: '1px solid #111' }}>
                  <div style={{ paddingTop: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid #ddd' }}>
                    <h2 style={{ ...smallCapsLabel, color: '#111', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      Top Attackers <FireIcon style={{ width: '0.8rem', height: '0.8rem', color: '#8b0000' }} />
                    </h2>
                    <p style={{ fontFamily: 'var(--font-lora), serif', fontSize: '0.7rem', color: '#888', marginTop: '0.2rem' }}>Percentage of successful attacks.</p>
                  </div>
                  {redTeamData.map((player, i) => (
                    <div key={player.name} className="flex items-center py-1.5" style={{ borderBottom: '1px solid #eee' }}>
                      <span style={{ width: 20, fontSize: '0.7rem', color: '#888', fontFamily: 'monospace', flexShrink: 0 }}>{i + 1}</span>
                      <span style={{ fontFamily: 'var(--font-lora), serif', fontSize: '0.78rem', color: '#111', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <Link href={`/users/${player.playerId}`} style={{ color: '#111', textDecoration: 'none' }}>{player.name}</Link>
                        {player.model && <span style={{ color: '#888', fontSize: '0.7rem', marginLeft: '0.25rem' }}>({player.model})</span>}
                      </span>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#555', flexShrink: 0, paddingLeft: '0.75rem' }}>{(player.attack * 100).toFixed(0)}%</span>
                    </div>
                  ))}
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
          <p style={{ fontFamily: 'var(--font-lora), serif', fontSize: '0.82rem', color: '#555', display: 'flex', gap: '1.5rem' }}>
            <span><span style={{ fontWeight: 700, color: '#111' }}>{challengesTotal.toLocaleString()}</span> Games</span>
            {scoringData.length > 0 && <span><span style={{ fontWeight: 700, color: '#111' }}>{scoringData.length}</span> Participants</span>}
            {stats?.challenges?.[name]?.gamesPlayed > 0 && <span><span style={{ fontWeight: 700, color: '#111' }}>{stats.challenges[name].gamesPlayed.toLocaleString()}</span> Completed</span>}
          </p>
        }
      />
    </section>
  );
}
