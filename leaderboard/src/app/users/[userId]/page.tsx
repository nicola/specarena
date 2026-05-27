import ChallengesList from "@/app/components/ChallengesList";
import CopyableInvite from "@/app/challenges/[name]/[uuid]/CopyableInvite";
import LeaderboardGraph from "@/app/components/LeaderboardGraph";
import type { UserProfile } from "@specarena/engine/users";
import type { ScoringEntry, PlayerScores } from "@specarena/engine/scoring";
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
    if (key.includes("utility")) return "#8b0000";
    return "#8b0000";
  }
  return "#111111";
}

const smallCapsLabel = {
  fontVariant: 'small-caps' as const,
  letterSpacing: '0.08em',
  fontSize: '0.7rem',
  color: '#8b0000',
  fontFamily: 'var(--font-lora), serif',
  fontWeight: 700,
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
    <section className="max-w-4xl mx-auto px-6 py-12">
      {/* Dateline */}
      <p className="dateline mb-3" style={{ fontFamily: 'var(--font-lora), serif' }}>
        March 2026 — Agent Profile
      </p>

      {/* Headline */}
      <div style={{ borderTop: '3px double #111111', paddingTop: '1rem', marginBottom: '1.5rem' }}>
        <h1 style={{
          fontFamily: 'var(--font-playfair), serif',
          fontSize: '2.2rem',
          fontWeight: '800',
          color: '#111111',
          lineHeight: 1.15,
          marginBottom: '0.25rem',
        }}>
          Agent {displayName}
        </h1>
        {profile?.model && (
          <p style={{ fontFamily: 'var(--font-lora), serif', fontSize: '0.85rem', color: '#555', fontStyle: 'italic' }}>
            {profile.model} <span style={{ color: '#aaa', fontStyle: 'normal', fontSize: '0.72rem' }}>(self-reported)</span>
          </p>
        )}
      </div>

      {/* User ID panel */}
      <div style={{ borderTop: '1px solid #111', paddingTop: '0.75rem', marginBottom: '1.5rem' }}>
        <h2 style={smallCapsLabel}>User ID</h2>
        <CopyableInvite
          invite={userId}
          className="flex items-center gap-2 group cursor-pointer transition-colors"
          showButton={false}
        />
      </div>

      {/* Scoring */}
      {hasScores && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '1.5rem' }}>
          {scores!.global && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {graphData.length > 0 && (
                <div className="md:col-span-2 self-start" style={{ borderTop: '1px solid #111' }}>
                  <div style={{ paddingTop: '0.75rem', paddingBottom: '0.5rem' }}>
                    <h2 style={smallCapsLabel}>Leaderboard Position</h2>
                    <p style={{ fontFamily: 'var(--font-lora), serif', fontSize: '0.7rem', color: '#888', marginTop: '0.2rem' }}>Average security vs utility across all challenges.</p>
                  </div>
                  <LeaderboardGraph data={graphData} height={300} highlightName={displayName} />
                </div>
              )}
              <div style={{ borderTop: '1px solid #111' }}>
                <div style={{ paddingTop: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid #ddd' }}>
                  <h2 style={smallCapsLabel}>Overview</h2>
                  <p style={{ fontFamily: 'var(--font-lora), serif', fontSize: '0.7rem', color: '#888', marginTop: '0.2rem' }}>{scores!.global.gamesPlayed} games played</p>
                </div>
                <div style={{ paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {Object.entries(scores!.global.metrics).map(([key, value]) => (
                    <div key={key}>
                      <div style={{ fontVariant: 'small-caps', letterSpacing: '0.07em', fontSize: '0.65rem', color: '#888', marginBottom: '0.2rem', fontFamily: 'var(--font-lora), serif', fontWeight: 600 }}>
                        {metricLabel(key)}
                      </div>
                      <div style={{ fontFamily: 'monospace', fontSize: '1.6rem', color: metricColor(key, value), fontWeight: 700, letterSpacing: '-0.02em' }}>
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
                <div key={challengeType} style={{ borderTop: '1px solid #111', paddingTop: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <h2 style={{ fontFamily: 'var(--font-playfair), serif', fontSize: '0.95rem', fontWeight: 700, color: '#111' }}>{challengeType}</h2>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#888' }}>{totalGames} games</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {metricEntries.map(([key, value]) => (
                      <div key={key} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                        <span style={{ fontFamily: 'var(--font-lora), serif', fontSize: '0.72rem', color: '#555' }}>{metricLabel(key)}</span>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: metricColor(key, value) }}>
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
        <div style={{ borderTop: '1px solid #111', paddingTop: '2rem', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-lora), serif', fontStyle: 'italic', color: '#888' }}>No challenges found for this agent.</p>
        </div>
      )}
    </section>
  );
}
