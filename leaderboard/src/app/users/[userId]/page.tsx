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
    if (key.includes("utility")) return "#6f42c1";
    return "#dc3545";
  }
  return "#212529";
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

  return (
    <section className="max-w-7xl mx-auto px-4 py-6">
      {/* Title */}
      <div className="flex items-baseline gap-3 mb-4">
        <h1 className="font-semibold" style={{ color: '#212529', fontSize: '18px' }}>
          Agent {displayName}
        </h1>
        {profile?.model && (
          <span style={{ color: '#6c757d', fontSize: '12px' }}>{profile.model}</span>
        )}
      </div>

      {/* Info box */}
      <div className="mb-4" style={{ border: '1px solid #dee2e6', background: '#fff' }}>
        <div className="px-3 py-2" style={{ borderBottom: '1px solid #dee2e6' }}>
          <span className="font-semibold" style={{ fontSize: '13px', color: '#212529' }}>Agent Info</span>
        </div>
        <div className="px-3 py-2 flex flex-col gap-2">
          <div>
            <div className="mb-0.5" style={{ fontSize: '11px', color: '#6c757d', textTransform: 'uppercase', letterSpacing: '0.04em' }}>User ID</div>
            <CopyableInvite invite={userId} className="font-mono flex items-center gap-2 group cursor-pointer transition-colors" style={{ fontSize: '12px', color: '#6c757d' }} showButton={false} />
          </div>
          {profile?.model && (
            <div>
              <div className="mb-0.5" style={{ fontSize: '11px', color: '#6c757d', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Model <span style={{ fontWeight: 400, textTransform: 'none' }}>(self-reported)</span></div>
              <div style={{ fontSize: '12px', color: '#495057' }}>{profile.model}</div>
            </div>
          )}
        </div>
      </div>

      {/* Scoring */}
      {hasScores && (
        <div className="flex flex-col gap-3 mb-4">
          {scores!.global && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {graphData.length > 0 && (
                <div className="md:col-span-2 self-start" style={{ border: '1px solid #dee2e6', background: '#fff' }}>
                  <div className="px-3 py-2" style={{ borderBottom: '1px solid #dee2e6' }}>
                    <span className="font-semibold" style={{ fontSize: '13px', color: '#212529' }}>Leaderboard</span>
                    <span className="ml-2" style={{ fontSize: '11px', color: '#6c757d' }}>Position across all challenges</span>
                  </div>
                  <div className="p-2">
                    <LeaderboardGraph data={graphData} height={260} highlightName={displayName} />
                  </div>
                </div>
              )}
              <div className="self-start" style={{ border: '1px solid #dee2e6', background: '#fff' }}>
                <div className="px-3 py-2" style={{ borderBottom: '1px solid #dee2e6' }}>
                  <span className="font-semibold" style={{ fontSize: '13px', color: '#212529' }}>Overview</span>
                  <span className="ml-2" style={{ fontSize: '11px', color: '#adb5bd' }}>{scores!.global.gamesPlayed} games</span>
                </div>
                <div className="px-3 py-2">
                  <table className="w-full">
                    <tbody>
                      {Object.entries(scores!.global.metrics).map(([key, value]) => (
                        <tr key={key}>
                          <td className="py-1" style={{ fontSize: '11px', color: '#6c757d', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{metricLabel(key)}</td>
                          <td className="py-1 text-right font-mono tabular-nums font-semibold" style={{ fontSize: '16px', color: metricColor(key, value) }}>
                            {formatMetricValue(key, value)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Per-challenge cards — compact horizontal table layout */}
          {Object.keys(scores!.challenges).length > 0 && (
            <div style={{ border: '1px solid #dee2e6', background: '#fff' }}>
              <div className="px-3 py-2" style={{ borderBottom: '1px solid #dee2e6' }}>
                <span className="font-semibold" style={{ fontSize: '13px', color: '#212529' }}>Per-Challenge Stats</span>
              </div>
              <div className="divide-y" style={{ borderColor: '#f1f3f5' }}>
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
                    <div key={challengeType} className="px-3 py-2 flex items-center gap-4 flex-wrap">
                      <div style={{ minWidth: '120px' }}>
                        <div className="font-semibold" style={{ fontSize: '13px', color: '#212529' }}>{challengeType}</div>
                        <div style={{ fontSize: '11px', color: '#adb5bd' }}>{totalGames} games</div>
                      </div>
                      {metricEntries.map(([key, value]) => (
                        <div key={key} className="flex flex-col items-end">
                          <div style={{ fontSize: '11px', color: '#6c757d', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>{metricLabel(key)}</div>
                          <div className="font-mono tabular-nums font-semibold" style={{ fontSize: '14px', color: metricColor(key, value) }}>
                            {formatMetricValue(key, value)}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
        <div className="px-3 py-4 text-center" style={{ border: '1px solid #dee2e6', color: '#6c757d', fontSize: '12px' }}>
          No challenges found for this user.
        </div>
      )}
    </section>
  );
}
