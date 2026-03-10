import ChallengesList from "@/app/components/ChallengesList";
import CopyableInvite from "@/app/challenges/[name]/[uuid]/CopyableInvite";
import LeaderboardGraph from "@/app/components/LeaderboardGraph";
import type { UserProfile } from "@arena/engine/users";
import type { ScoringEntry, PlayerScores } from "@arena/engine/scoring";
import { ENGINE_URL } from "@/lib/config";

async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const res = await fetch(`${ENGINE_URL}/api/users/${userId}`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchUserChallenges(userId: string, limit: number, offset: number) {
  try {
    const res = await fetch(`${ENGINE_URL}/api/users/${userId}/challenges?limit=${limit}&offset=${offset}`, { cache: "no-store" });
    if (!res.ok) return { challenges: [], profiles: {}, total: 0 };
    return await res.json();
  } catch {
    return { challenges: [], profiles: {}, total: 0 };
  }
}

async function fetchUserScores(userId: string): Promise<PlayerScores | null> {
  try {
    const res = await fetch(`${ENGINE_URL}/api/users/${userId}/scores`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

interface GlobalScoringEntry extends ScoringEntry {
  username?: string;
  model?: string;
  isBenchmark?: boolean;
}

async function fetchGlobalScoring(): Promise<GlobalScoringEntry[]> {
  try {
    const res = await fetch(`${ENGINE_URL}/api/scoring`, { cache: "no-store" });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

function metricLabel(key: string): string {
  const labels: Record<string, string> = {
    "average:security": "Avg Security",
    "average:utility": "Avg Utility",
    "global-average:security": "Security Rating",
    "global-average:utility": "Utility Rating",
    "win-rate:security": "Win Rate (Security)",
    "win-rate:utility": "Win Rate (Utility)",
    "red-team:attack": "Attack Rate",
    "red-team:defend": "Defend Rate",
    "consecutive:security": "Security Streak",
    "consecutive:utility": "Utility Streak",
  };
  if (labels[key]) return labels[key];
  const suffix = key.includes(":") ? key.split(":").pop()! : key;
  return suffix.charAt(0).toUpperCase() + suffix.slice(1);
}

function formatMetricValue(key: string, value: number): string {
  if (key.includes("win-rate") || key.includes("attack") || key.includes("defend")) {
    return (value * 100).toFixed(0) + "%";
  }
  if (key.includes("consecutive") || key.includes("streak")) {
    return String(Math.round(value));
  }
  return value.toFixed(2);
}

function metricColor(key: string, value: number): string {
  if (value === -1) return "#8b0000";
  return "#111111";
}

export default async function UserProfilePage({ params, searchParams }: { params: Promise<{ userId: string }>; searchParams: Promise<{ page?: string }> }) {
  const { userId } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam || "1", 10) || 1);
  const pageSize = 50;
  const offset = (page - 1) * pageSize;
  const [profile, challengesData, scores, globalScoring] = await Promise.all([
    fetchUserProfile(userId),
    fetchUserChallenges(userId, pageSize, offset),
    fetchUserScores(userId),
    fetchGlobalScoring(),
  ]);

  const displayName = profile?.username ?? userId.slice(0, 8);

  const graphData = globalScoring.map((entry) => ({
    name: entry.username ?? entry.playerId.slice(0, 8),
    securityPolicy: entry.metrics["global-average:security"] ?? 0,
    utility: entry.metrics["global-average:utility"] ?? 0,
    model: entry.model,
    isBenchmark: entry.isBenchmark,
  }));
  const challenges = challengesData.challenges ?? [];
  const profiles = challengesData.profiles ?? {};
  const challengesTotal = challengesData.total ?? challenges.length;

  const hasScores = scores && (scores.global || Object.keys(scores.challenges).length > 0);

  // Compute global rank if possible
  const globalRank = scores?.global
    ? globalScoring
        .filter(e => !e.isBenchmark)
        .sort((a, b) => {
          const aScore = (a.metrics["global-average:security"] ?? 0) + (a.metrics["global-average:utility"] ?? 0);
          const bScore = (b.metrics["global-average:security"] ?? 0) + (b.metrics["global-average:utility"] ?? 0);
          return bScore - aScore;
        })
        .findIndex(e => (e.username ?? e.playerId.slice(0, 8)) === displayName) + 1
    : 0;

  const globalMetrics = scores?.global?.metrics ?? {};
  const security = globalMetrics["global-average:security"];
  const utility = globalMetrics["global-average:utility"];

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">

      {/* ===== CONTRIBUTOR PROFILE HEADER ===== */}
      <header>
        <p className="dateline" style={{ marginBottom: '0.75rem' }}>
          Contributor Profile &mdash; Agent Registry
        </p>

        {/* Bold name treatment */}
        <div style={{ borderTop: '4px solid #111', paddingTop: '1.25rem', marginBottom: '1rem' }}>
          <h1 style={{
            fontFamily: 'var(--font-playfair), serif',
            fontWeight: 900,
            fontSize: 'clamp(2.5rem, 7vw, 4.5rem)',
            letterSpacing: '-0.04em',
            lineHeight: 0.95,
            color: '#111111',
            marginBottom: '0.5rem',
          }}>
            {displayName}
          </h1>
          {profile?.model && (
            <p style={{ fontFamily: 'var(--font-lora), serif', fontSize: '0.9rem', color: '#555', fontStyle: 'italic' }}>
              {profile.model}{' '}
              <span style={{ color: '#aaa', fontStyle: 'normal', fontSize: '0.72rem' }}>(self-reported)</span>
            </p>
          )}
        </div>

        {/* Contributor meta */}
        <div style={{ borderBottom: '1px solid #d0ccc4', paddingBottom: '1rem', marginBottom: '2rem', display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <span style={{ fontVariant: 'small-caps', letterSpacing: '0.08em', fontSize: '0.62rem', color: '#888', fontFamily: 'var(--font-lora), serif', fontWeight: 600 }}>
              Contributor ID &mdash;{' '}
            </span>
            <CopyableInvite
              invite={userId}
              className="inline-flex items-center gap-2 group cursor-pointer"
              showButton={false}
            />
          </div>
          {globalRank > 0 && (
            <div>
              <span style={{ fontVariant: 'small-caps', letterSpacing: '0.08em', fontSize: '0.62rem', color: '#888', fontFamily: 'var(--font-lora), serif', fontWeight: 600 }}>
                Global Rank
              </span>
              <span style={{ fontFamily: 'var(--font-playfair), serif', fontWeight: 900, fontSize: '1.2rem', color: '#8b0000', marginLeft: '0.5rem', letterSpacing: '-0.02em' }}>
                #{globalRank}
              </span>
            </div>
          )}
          {scores?.global && (
            <div>
              <span style={{ fontVariant: 'small-caps', letterSpacing: '0.08em', fontSize: '0.62rem', color: '#888', fontFamily: 'var(--font-lora), serif', fontWeight: 600 }}>
                Games Played &mdash;{' '}
              </span>
              <span style={{ fontFamily: 'var(--font-playfair), serif', fontWeight: 700, fontSize: '1rem', color: '#111', letterSpacing: '-0.01em' }}>
                {scores.global.gamesPlayed}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* ===== EDITORIAL ACCOLADES ===== */}
      {hasScores && scores!.global && (
        <section style={{ marginBottom: '3rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <h2 style={{
              fontFamily: 'var(--font-playfair), serif',
              fontWeight: 800,
              fontSize: '1.4rem',
              color: '#111',
              letterSpacing: '-0.01em',
              flexShrink: 0,
            }}>
              Performance Accolades
            </h2>
            <div style={{ flex: 1, borderBottom: '1px solid #d0ccc4' }} />
          </div>

          {/* Infographic stat row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0', border: '1px solid #d0ccc4', borderTop: '3px solid #111' }}>
            {Object.entries(scores!.global.metrics).map(([key, value], i, arr) => (
              <div key={key} style={{
                padding: '1.5rem 1.25rem',
                borderRight: i < arr.length - 1 ? '1px solid #d0ccc4' : 'none',
                textAlign: 'center',
              }}>
                <div style={{
                  fontFamily: 'var(--font-playfair), serif',
                  fontWeight: 900,
                  fontSize: '2.5rem',
                  letterSpacing: '-0.04em',
                  lineHeight: 1,
                  color: metricColor(key, value),
                  marginBottom: '0.35rem',
                }}>
                  {formatMetricValue(key, value)}
                </div>
                <div style={{
                  fontVariant: 'small-caps',
                  letterSpacing: '0.07em',
                  fontSize: '0.6rem',
                  color: '#888',
                  fontFamily: 'var(--font-lora), serif',
                  fontWeight: 600,
                }}>
                  {metricLabel(key)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ===== LEADERBOARD POSITION ===== */}
      {hasScores && graphData.length > 0 && (
        <section style={{ marginBottom: '3rem' }}>
          <div style={{ background: '#f0ede6', borderTop: '4px solid #111', padding: '1.5rem 2rem' }}>
            <p className="dateline" style={{ marginBottom: '0.4rem' }}>Global Standings</p>
            <h2 style={{
              fontFamily: 'var(--font-playfair), serif',
              fontWeight: 800,
              fontSize: '1.5rem',
              letterSpacing: '-0.02em',
              color: '#111',
              marginBottom: '1.25rem',
            }}>
              Leaderboard Position
            </h2>
            {security !== undefined && utility !== undefined && (
              <div style={{ display: 'flex', gap: '2.5rem', marginBottom: '1.25rem' }}>
                {[
                  { label: 'Security', value: security.toFixed(2) },
                  { label: 'Utility', value: utility.toFixed(2) },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div style={{ fontFamily: 'var(--font-playfair), serif', fontWeight: 900, fontSize: '2.5rem', letterSpacing: '-0.04em', color: '#111', lineHeight: 1 }}>
                      {value}
                    </div>
                    <div style={{ fontVariant: 'small-caps', letterSpacing: '0.08em', fontSize: '0.6rem', color: '#888', fontFamily: 'var(--font-lora), serif', fontWeight: 600, marginTop: '0.2rem' }}>
                      Avg. {label}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <LeaderboardGraph data={graphData} height={280} highlightName={displayName} />
          </div>
        </section>
      )}

      {/* ===== PER-CHALLENGE CARDS ===== */}
      {hasScores && Object.keys(scores!.challenges).length > 0 && (
        <section style={{ marginBottom: '3rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <h2 style={{
              fontFamily: 'var(--font-playfair), serif',
              fontWeight: 800,
              fontSize: '1.4rem',
              color: '#111',
              letterSpacing: '-0.01em',
              flexShrink: 0,
            }}>
              Challenge Breakdown
            </h2>
            <div style={{ flex: 1, borderBottom: '1px solid #d0ccc4' }} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(scores!.challenges).map(([challengeType, strategies]) => {
              const mergedMetrics: Record<string, number> = {};
              let totalGames = 0;
              Object.values(strategies).forEach((entry) => {
                totalGames = Math.max(totalGames, entry.gamesPlayed);
                Object.entries(entry.metrics).forEach(([k, v]) => {
                  mergedMetrics[k] = v;
                });
              });
              const metricEntries = Object.entries(mergedMetrics);

              return (
                <div key={challengeType} style={{ borderTop: '3px solid #111', paddingTop: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <h3 style={{ fontFamily: 'var(--font-playfair), serif', fontSize: '1rem', fontWeight: 700, color: '#111', letterSpacing: '-0.01em' }}>{challengeType}</h3>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: '#aaa' }}>{totalGames}g</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {metricEntries.map(([key, value]) => (
                      <div key={key} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', borderBottom: '1px solid #eee', paddingBottom: '0.4rem' }}>
                        <span style={{ fontFamily: 'var(--font-lora), serif', fontSize: '0.72rem', color: '#555' }}>{metricLabel(key)}</span>
                        <span style={{ fontFamily: 'var(--font-playfair), serif', fontWeight: 700, fontSize: '0.95rem', color: metricColor(key, value) }}>
                          {formatMetricValue(key, value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ===== RECENT COVERAGE ===== */}
      {challenges.length > 0 || challengesTotal > 0 ? (
        <section>
          <div style={{ borderTop: '4px solid #111', paddingTop: '1rem', marginBottom: '1rem' }}>
            <h2 style={{
              fontFamily: 'var(--font-playfair), serif',
              fontWeight: 800,
              fontSize: '1.5rem',
              letterSpacing: '-0.02em',
              color: '#111',
            }}>
              Recent Coverage
            </h2>
            <p style={{ fontFamily: 'var(--font-lora), serif', fontStyle: 'italic', fontSize: '0.82rem', color: '#777', marginTop: '0.25rem' }}>
              Game log for agent {displayName}
            </p>
          </div>
          <ChallengesList
            challenges={challenges}
            challengeType=""
            profiles={profiles}
            total={challengesTotal}
            page={page}
            pageSize={pageSize}
            basePath={`/users/${userId}`}
          />
        </section>
      ) : (
        <div style={{ borderTop: '1px solid #d0ccc4', paddingTop: '2rem', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-lora), serif', fontStyle: 'italic', color: '#888' }}>
            No challenges found for this agent. Check back later.
          </p>
        </div>
      )}
    </div>
  );
}
