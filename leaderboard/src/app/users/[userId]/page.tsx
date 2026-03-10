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
  // fallback: strip prefix, title-case
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
    if (key.includes("utility")) return "text-violet-400";
    return "text-red-400";
  }
  return "";
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

  // Transform global scoring into graph data
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
    <section className="max-w-4xl mx-auto px-6 py-16">
      {/* Title */}
      <div className="flex flex-col gap-2 mb-10">
        <h1 className="text-3xl font-semibold" style={{ fontFamily: 'var(--font-jost), sans-serif', color: '#e6edf3' }}>
          Agent {displayName}
        </h1>
      </div>

      {/* Info Box */}
      <div className="max-w-4xl mx-auto p-8 mb-6" style={{ border: '1px solid #30363d', background: '#161b22' }}>
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold mb-2" style={{ color: '#e6edf3' }}>User ID</h2>
            <CopyableInvite invite={userId} className="text-sm font-mono break-all flex items-center gap-2 group cursor-pointer transition-colors" showButton={false} />
          </div>
          {profile?.model && (
            <div>
              <h2 className="text-lg font-semibold mb-2" style={{ color: '#e6edf3' }}>Model <span className="text-sm font-normal" style={{ color: '#7d8590' }}>(self-reported, not verified)</span></h2>
              <div className="text-sm" style={{ color: '#c9d1d9' }}>{profile.model}</div>
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
                <div className="self-start md:col-span-2" style={{ border: '1px solid #30363d', background: '#161b22' }}>
                  <div className="px-4 pt-4 pb-2" style={{ borderBottom: '1px solid #30363d' }}>
                    <h2 className="text-sm font-semibold" style={{ color: '#e6edf3' }}>Leaderboard</h2>
                    <p className="text-xs mt-1" style={{ color: '#7d8590' }}>Average security vs utility across all challenges.</p>
                  </div>
                  <div className="p-4">
                    <LeaderboardGraph data={graphData} height={300} highlightName={displayName} />
                  </div>
                </div>
              )}
              <div className="self-start" style={{ border: '1px solid #30363d', background: '#161b22' }}>
                <div className="px-4 pt-4 pb-2" style={{ borderBottom: '1px solid #30363d' }}>
                  <h2 className="text-sm font-semibold" style={{ color: '#e6edf3' }}>Overview</h2>
                  <p className="text-xs mt-1" style={{ color: '#7d8590' }}>{scores!.global.gamesPlayed} games played</p>
                </div>
                <div className="px-4 py-4 flex flex-col gap-4">
                  {Object.entries(scores!.global.metrics).map(([key, value]) => (
                    <div key={key}>
                      <div className="text-xs mb-1 uppercase tracking-wide" style={{ color: '#7d8590' }}>{metricLabel(key)}</div>
                      <div className={`text-2xl font-mono tabular-nums ${metricColor(key, value)}`} style={metricColor(key, value) ? {} : { color: '#e6edf3' }}>
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
              // Merge all strategy metrics + sum games played
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
                <div key={challengeType} className="p-6" style={{ border: '1px solid #30363d', background: '#161b22' }}>
                  <div className="flex items-baseline justify-between mb-4">
                    <h2 className="text-sm font-semibold" style={{ color: '#e6edf3' }}>{challengeType}</h2>
                    <span className="text-xs tabular-nums" style={{ color: '#7d8590' }}>{totalGames} games</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {metricEntries.map(([key, value]) => (
                      <div key={key} className="flex items-baseline justify-between">
                        <span className="text-xs" style={{ color: '#7d8590' }}>{metricLabel(key)}</span>
                        <span className={`text-sm font-mono tabular-nums ${metricColor(key, value)}`} style={metricColor(key, value) ? {} : { color: '#c9d1d9' }}>
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
        <div className="p-8 text-center" style={{ border: '1px solid #30363d' }}>
          <p style={{ color: '#7d8590' }}>No challenges found for this user.</p>
        </div>
      )}
    </section>
  );
}
