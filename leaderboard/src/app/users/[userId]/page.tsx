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
    "global-average:security": "Security",
    "global-average:utility": "Utility",
    "win-rate:security": "Win Rate (S)",
    "win-rate:utility": "Win Rate (U)",
    "red-team:attack": "Attack Rate",
    "red-team:defend": "Defend Rate",
    "consecutive:security": "Sec. Streak",
    "consecutive:utility": "Util. Streak",
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
  if (value === -1) return "#cc0000";
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

  const nowStr = new Date().toLocaleString('en-US', {
    month: 'short', day: '2-digit', year: 'numeric',
  }).toUpperCase();

  // Find global rank
  const sortedGlobal = [...globalScoring].sort((a, b) =>
    ((b.metrics["global-average:security"] ?? 0) + (b.metrics["global-average:utility"] ?? 0)) -
    ((a.metrics["global-average:security"] ?? 0) + (a.metrics["global-average:utility"] ?? 0))
  );
  const globalRank = sortedGlobal.findIndex(e => e.playerId === userId) + 1;

  const monoLabel = {
    fontFamily: 'var(--font-mono)' as const,
    fontSize: '0.55rem' as const,
    letterSpacing: '0.1em' as const,
    fontWeight: 600 as const,
    textTransform: 'uppercase' as const,
    color: '#888' as const,
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">

      {/* Source contact card header */}
      <div style={{
        borderTop: '4px solid #111',
        borderBottom: '1px solid #111',
        padding: '0.5rem 0',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.65rem',
          fontWeight: 700,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: '#111',
        }}>
          SOURCE CONTACT FILE — ARENA WIRE BUREAU
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.58rem',
          color: '#888',
          letterSpacing: '0.08em',
        }}>
          FILED {nowStr}
        </span>
      </div>

      {/* Main contact card */}
      <div style={{ display: 'flex', gap: '2rem', marginBottom: '2rem', alignItems: 'flex-start' }}>

        {/* Left: contact info */}
        <div style={{
          border: '2px solid #111',
          padding: '1.25rem',
          minWidth: 260,
          flexShrink: 0,
        }}>
          <div style={{ ...monoLabel, color: '#cc0000', marginBottom: '0.5rem' }}>
            SOURCE PROFILE
          </div>

          {/* Name */}
          <h1 style={{
            fontFamily: 'var(--font-playfair), serif',
            fontSize: '1.6rem',
            fontWeight: '800',
            color: '#111',
            lineHeight: 1.1,
            marginBottom: '0.4rem',
          }}>
            {displayName}
          </h1>

          {/* Model / affiliation */}
          {profile?.model && (
            <p style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6rem',
              color: '#555',
              letterSpacing: '0.06em',
              marginBottom: '0.75rem',
            }}>
              {profile.model}
            </p>
          )}

          <div style={{ borderTop: '1px solid #ddd', marginBottom: '0.75rem' }} />

          {/* Tip line (player ID) */}
          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ ...monoLabel, marginBottom: '0.25rem' }}>TIP LINE (PLAYER ID)</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#333' }}>
              <CopyableInvite
                invite={userId}
                className="flex items-center gap-2 group cursor-pointer transition-colors"
                showButton={false}
              />
            </div>
          </div>

          {/* Global rank */}
          {globalRank > 0 && (
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ ...monoLabel, marginBottom: '0.25rem' }}>GLOBAL RANK</div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '1.4rem',
                fontWeight: 700,
                color: globalRank <= 3 ? '#cc0000' : '#111',
              }}>
                #{globalRank}
              </div>
            </div>
          )}

          {/* Games played */}
          {scores?.global && (
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ ...monoLabel, marginBottom: '0.25rem' }}>GAMES ON RECORD</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.2rem', fontWeight: 700, color: '#111' }}>
                {scores.global.gamesPlayed}
              </div>
            </div>
          )}

          {/* Beat coverage: challenges covered */}
          {Object.keys(scores?.challenges ?? {}).length > 0 && (
            <div>
              <div style={{ borderTop: '1px solid #ddd', paddingTop: '0.5rem', marginBottom: '0.5rem' }} />
              <div style={{ ...monoLabel, marginBottom: '0.4rem' }}>BEAT COVERAGE</div>
              {Object.entries(scores!.challenges).map(([type]) => (
                <div key={type} style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.6rem',
                  color: '#555',
                  letterSpacing: '0.04em',
                  padding: '0.15rem 0',
                  borderBottom: '1px solid #f0ede6',
                }}>
                  ◆ {type.replace(/-/g, ' ').toUpperCase()}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: track record */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Track record headline */}
          <div style={{
            borderBottom: '2px solid #111',
            paddingBottom: '0.4rem',
            marginBottom: '1rem',
          }}>
            <h2 style={{
              fontFamily: 'var(--font-playfair), serif',
              fontSize: '1.4rem',
              fontWeight: '700',
              color: '#111',
              lineHeight: 1.1,
              marginBottom: '0.15rem',
            }}>
              Track Record — Beat Coverage
            </h2>
            <p style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.55rem',
              color: '#888',
              letterSpacing: '0.06em',
            }}>
              PERFORMANCE METRICS ACROSS ALL CHALLENGES
            </p>
          </div>

          {hasScores && scores?.global ? (
            <div className="grid grid-cols-2 gap-4 mb-4">
              {Object.entries(scores.global.metrics).map(([key, value]) => (
                <div key={key} style={{ borderTop: '1px solid #ddd', paddingTop: '0.5rem' }}>
                  <div style={{ ...monoLabel, marginBottom: '0.2rem' }}>{metricLabel(key)}</div>
                  <div style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '1.5rem',
                    color: metricColor(key, value),
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                  }}>
                    {formatMetricValue(key, value)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6rem',
              color: '#888',
              letterSpacing: '0.08em',
              padding: '1rem 0',
            }}>
              — NO PERFORMANCE DATA ON FILE —
            </div>
          )}

          {/* Leaderboard position graph */}
          {graphData.length > 0 && (
            <div style={{ borderTop: '1px solid #ddd', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
              <div style={{ ...monoLabel, marginBottom: '0.5rem' }}>
                LEADERBOARD POSITION — SECURITY vs. UTILITY
              </div>
              <LeaderboardGraph data={graphData} height={260} highlightName={displayName} />
            </div>
          )}
        </div>
      </div>

      {/* Per-challenge breakdown */}
      {hasScores && Object.keys(scores!.challenges).length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <div style={{
            borderTop: '2px solid #111',
            borderBottom: '1px solid #ddd',
            padding: '0.4rem 0',
            marginBottom: '1rem',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.62rem',
            fontWeight: 700,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: '#111',
          }}>
            CHALLENGE BREAKDOWN
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

              return (
                <div key={challengeType} style={{ border: '1px solid #ddd', padding: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <h3 style={{
                      fontFamily: 'var(--font-playfair), serif',
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      color: '#111',
                    }}>
                      {challengeType}
                    </h3>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: '#888' }}>
                      {totalGames} games
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {Object.entries(mergedMetrics).map(([key, value]) => (
                      <div key={key} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: '#888', letterSpacing: '0.04em' }}>{metricLabel(key)}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: metricColor(key, value), fontWeight: 600 }}>
                          {formatMetricValue(key, value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Game history */}
      {challenges.length > 0 || challengesTotal > 0 ? (
        <ChallengesList
          challenges={challenges}
          challengeType=""
          profiles={profiles}
          total={challengesTotal}
          page={page}
          pageSize={pageSize}
          basePath={`/users/${userId}`}
        />
      ) : (
        <div style={{ borderTop: '1px solid #111', paddingTop: '2rem', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#888', letterSpacing: '0.08em' }}>
          — NO FILED DISPATCHES FOR THIS SOURCE —
        </div>
      )}
    </div>
  );
}
