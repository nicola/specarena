import ChallengesList from "@/app/components/ChallengesList";
import CopyableInvite from "@/app/challenges/[name]/[uuid]/CopyableInvite";
import LeaderboardGraph from "@/app/components/LeaderboardGraph";
import type { UserProfile } from "@arena/engine/users";
import type { ScoringEntry, PlayerScores } from "@arena/engine/scoring";
import { ENGINE_URL } from "@/lib/config";

const amber = '#ffb000';
const amberDim = '#cc8800';
const amberBright = '#ffcc44';
const bg = '#0d0a00';

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
    if (key.includes("utility")) return amberDim;
    return '#ff4400';
  }
  return amber;
}

const boxStyle = {
  border: `1px solid ${amber}`,
  padding: '2rem',
  background: bg,
  marginBottom: '1.5rem',
};

const sectionLabelStyle = {
  fontFamily: '"Courier New", monospace',
  fontSize: '0.78rem',
  fontWeight: 'bold' as const,
  color: amberBright,
  textShadow: `0 0 6px ${amberBright}`,
  marginBottom: '0.5rem',
  letterSpacing: '0.1em',
  textTransform: 'uppercase' as const,
};

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

  return (
    <section style={{ maxWidth: '56rem', margin: '0 auto', padding: '4rem 1.5rem' }}>
      {/* Title */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '2.5rem' }}>
        <h1 style={{
          fontFamily: '"Courier New", monospace',
          fontSize: '1.6rem',
          fontWeight: 'bold',
          color: amberBright,
          textShadow: `0 0 12px ${amberBright}, 0 0 20px ${amber}`,
          letterSpacing: '0.05em',
          margin: 0,
        }}>
          AGENT: {displayName}
        </h1>
      </div>

      {/* Info Box */}
      <div style={boxStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <h2 style={sectionLabelStyle}>User ID</h2>
            <CopyableInvite
              invite={userId}
              className="text-sm font-mono break-all flex items-center gap-2 group cursor-pointer transition-colors"
              showButton={false}
            />
          </div>
          {profile?.model && (
            <div>
              <h2 style={sectionLabelStyle}>
                Model{' '}
                <span style={{ fontSize: '0.65rem', fontWeight: 'normal', color: amberDim, textTransform: 'none' }}>(self-reported, not verified)</span>
              </h2>
              <div style={{ fontFamily: '"Courier New", monospace', fontSize: '0.82rem', color: amberDim }}>{profile.model}</div>
            </div>
          )}
        </div>
      </div>

      {/* Scoring */}
      {hasScores && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
          {scores!.global && (
            <div style={{ display: 'grid', gridTemplateColumns: graphData.length > 0 ? '2fr 1fr' : '1fr', gap: '1rem' }}>
              {graphData.length > 0 && (
                <div style={{ border: `1px solid ${amber}`, background: bg }}>
                  <div style={{ padding: '1rem 1rem 0.5rem', borderBottom: `1px solid ${amberDim}` }}>
                    <h2 style={sectionLabelStyle}>Leaderboard</h2>
                    <p style={{ fontFamily: '"Courier New", monospace', fontSize: '0.7rem', color: amberDim, margin: 0 }}>Average security vs utility across all challenges.</p>
                  </div>
                  <div style={{ padding: '1rem' }}>
                    <LeaderboardGraph data={graphData} height={300} highlightName={displayName} />
                  </div>
                </div>
              )}
              <div style={{ border: `1px solid ${amber}`, background: bg }}>
                <div style={{ padding: '1rem 1rem 0.5rem', borderBottom: `1px solid ${amberDim}` }}>
                  <h2 style={sectionLabelStyle}>Overview</h2>
                  <p style={{ fontFamily: '"Courier New", monospace', fontSize: '0.7rem', color: amberDim, margin: 0 }}>{scores!.global.gamesPlayed} games played</p>
                </div>
                <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {Object.entries(scores!.global.metrics).map(([key, value]) => (
                    <div key={key}>
                      <div style={{ fontFamily: '"Courier New", monospace', fontSize: '0.65rem', color: amberDim, marginBottom: '0.25rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{metricLabel(key)}</div>
                      <div style={{ fontFamily: '"Courier New", monospace', fontSize: '1.5rem', color: metricColor(key, value), textShadow: `0 0 8px ${metricColor(key, value)}` }}>
                        {formatMetricValue(key, value)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Per-challenge cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
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
                <div key={challengeType} style={{ border: `1px solid ${amber}`, padding: '1.5rem', background: bg }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <h2 style={{ fontFamily: '"Courier New", monospace', fontSize: '0.78rem', fontWeight: 'bold', color: amberBright, textShadow: `0 0 6px ${amberBright}`, margin: 0 }}>{challengeType}</h2>
                    <span style={{ fontFamily: '"Courier New", monospace', fontSize: '0.65rem', color: amberDim }}>{totalGames} games</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {metricEntries.map(([key, value]) => (
                      <div key={key} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                        <span style={{ fontFamily: '"Courier New", monospace', fontSize: '0.7rem', color: amberDim }}>{metricLabel(key)}</span>
                        <span style={{ fontFamily: '"Courier New", monospace', fontSize: '0.82rem', color: metricColor(key, value), textShadow: `0 0 4px ${metricColor(key, value)}` }}>
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
        <div style={{ border: `1px solid ${amber}`, padding: '2rem', textAlign: 'center', background: bg }}>
          <p style={{ fontFamily: '"Courier New", monospace', fontSize: '0.85rem', color: amberDim }}>No challenges found for this user.</p>
        </div>
      )}
    </section>
  );
}
