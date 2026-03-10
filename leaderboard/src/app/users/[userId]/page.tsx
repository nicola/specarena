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
  if (value === -1) {
    if (key.includes("utility")) return "#7b2fff";
    return "#ff4d6d";
  }
  if (key.includes("security")) return "#00b4d8";
  if (key.includes("utility")) return "#ff006e";
  return "#e0d0f0";
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

  const cardStyle = {
    border: '1px solid #7b2fff',
    boxShadow: '0 0 15px rgba(123,47,255,0.3)',
    background: 'rgba(26,5,51,0.6)',
  };

  const sectionHeadStyle = {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#ff006e',
    fontFamily: 'Orbitron, sans-serif',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  };

  const dividerStyle = {
    borderBottom: '1px solid rgba(123,47,255,0.3)',
  };

  return (
    <section className="max-w-4xl mx-auto px-6 py-16">
      {/* Title */}
      <div className="flex flex-col gap-2 mb-10">
        <h1 style={{
          fontFamily: 'Orbitron, sans-serif',
          fontSize: '2rem',
          fontWeight: 700,
          background: 'linear-gradient(135deg, #ff006e, #8338ec, #3a86ff)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          Agent {displayName}
        </h1>
      </div>

      {/* Info Box */}
      <div style={{ ...cardStyle, padding: '32px', marginBottom: '24px' }}>
        <div className="flex flex-col gap-4">
          <div>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#00b4d8', marginBottom: '8px', fontFamily: 'Orbitron, sans-serif' }}>User ID</h2>
            <CopyableInvite invite={userId} className="text-sm font-mono break-all flex items-center gap-2 group cursor-pointer transition-colors" showButton={false} />
          </div>
          {profile?.model && (
            <div>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#00b4d8', marginBottom: '8px', fontFamily: 'Orbitron, sans-serif' }}>
                Model <span style={{ fontSize: '0.875rem', fontWeight: 400, color: '#9d7fba' }}>(self-reported, not verified)</span>
              </h2>
              <div style={{ fontSize: '0.875rem', color: '#c4b5d4' }}>{profile.model}</div>
            </div>
          )}
        </div>
      </div>

      {/* Scoring */}
      {hasScores && (
        <div className="flex flex-col gap-4 mb-6">
          {/* Leaderboard graph + Overview sidebar */}
          {scores!.global && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {graphData.length > 0 && (
                <div style={cardStyle} className="self-start md:col-span-2">
                  <div style={{ padding: '16px 16px 8px', ...dividerStyle }}>
                    <h2 style={sectionHeadStyle}>Leaderboard</h2>
                    <p style={{ fontSize: '0.75rem', color: '#9d7fba', marginTop: '4px' }}>Average security vs utility across all challenges.</p>
                  </div>
                  <div style={{ padding: '16px' }}>
                    <LeaderboardGraph data={graphData} height={300} highlightName={displayName} />
                  </div>
                </div>
              )}
              <div style={cardStyle} className="self-start">
                <div style={{ padding: '16px 16px 8px', ...dividerStyle }}>
                  <h2 style={sectionHeadStyle}>Overview</h2>
                  <p style={{ fontSize: '0.75rem', color: '#9d7fba', marginTop: '4px' }}>{scores!.global.gamesPlayed} games played</p>
                </div>
                <div style={{ padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {Object.entries(scores!.global.metrics).map(([key, value]) => (
                    <div key={key}>
                      <div style={{ fontSize: '0.75rem', color: '#9d7fba', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{metricLabel(key)}</div>
                      <div style={{ fontSize: '1.5rem', fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums', color: metricColor(key, value) }}>
                        {formatMetricValue(key, value)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Per-challenge cards */}
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
                <div key={challengeType} style={{ ...cardStyle, padding: '24px' }}>
                  <div className="flex items-baseline justify-between" style={{ marginBottom: '16px' }}>
                    <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#ff006e', fontFamily: 'Orbitron, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{challengeType}</h2>
                    <span style={{ fontSize: '0.75rem', color: '#9d7fba', fontVariantNumeric: 'tabular-nums' }}>{totalGames} games</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {metricEntries.map(([key, value]) => (
                      <div key={key} className="flex items-baseline justify-between">
                        <span style={{ fontSize: '0.75rem', color: '#9d7fba' }}>{metricLabel(key)}</span>
                        <span style={{ fontSize: '0.875rem', fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums', color: metricColor(key, value) }}>
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

      {/* Challenges */}
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
        <div style={{ ...cardStyle, padding: '32px', textAlign: 'center' }}>
          <p style={{ color: '#9d7fba' }}>No challenges found for this user.</p>
        </div>
      )}
    </section>
  );
}
