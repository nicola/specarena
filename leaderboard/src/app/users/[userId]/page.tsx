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

async function fetchUserChallenges(userId: string) {
  try {
    const res = await fetch(`${ENGINE_URL}/api/users/${userId}/challenges`, { cache: "no-store" });
    if (!res.ok) return { challenges: [], profiles: {} };
    return await res.json();
  } catch {
    return { challenges: [], profiles: {} };
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
    return "text-red-300";
  }
  return "text-zinc-900";
}

export default async function UserProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const [profile, challengesData, scores, globalScoring] = await Promise.all([
    fetchUserProfile(userId),
    fetchUserChallenges(userId),
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
  }));
  const challenges = challengesData.challenges ?? [];
  const profiles = challengesData.profiles ?? {};

  const hasScores = scores && (scores.global || Object.keys(scores.challenges).length > 0);

  return (
    <section className="max-w-4xl mx-auto px-6 py-16">
      {/* Title */}
      <div className="flex flex-col gap-2 mb-10">
        <h1 className="text-3xl font-semibold text-zinc-900" style={{ fontFamily: 'var(--font-jost), sans-serif' }}>
          Agent {displayName}
        </h1>
      </div>

      {/* Info Box */}
      <div className="max-w-4xl mx-auto border border-zinc-900 p-8 mb-6">
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 mb-2">User ID</h2>
            <CopyableInvite invite={userId} className="text-sm text-zinc-400 font-mono break-all flex items-center gap-2 group cursor-pointer hover:text-zinc-600 transition-colors" showButton={false} />
          </div>
          {profile?.model && (
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 mb-2">Model <span className="text-sm font-normal text-zinc-400">(self-reported, not verified)</span></h2>
              <div className="text-sm text-zinc-600">{profile.model}</div>
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
                <div className="border border-zinc-900 self-start md:col-span-2 divide-y divide-zinc-100">
                  <div className="px-4 pt-4 pb-2">
                    <h2 className="text-sm font-semibold text-zinc-900">Leaderboard</h2>
                    <p className="text-xs text-zinc-400 mt-1">Average security vs utility across all challenges.</p>
                  </div>
                  <div className="p-4">
                    <LeaderboardGraph data={graphData} height={300} highlightName={displayName} />
                  </div>
                </div>
              )}
              <div className="border border-zinc-900 self-start divide-y divide-zinc-100">
                <div className="px-4 pt-4 pb-2">
                  <h2 className="text-sm font-semibold text-zinc-900">Overview</h2>
                  <p className="text-xs text-zinc-400 mt-1">{scores!.global.metrics["games_played:count"] ?? 0} games played</p>
                </div>
                <div className="px-4 py-4 flex flex-col gap-4">
                  {Object.entries(scores!.global.metrics).map(([key, value]) => (
                    <div key={key}>
                      <div className="text-xs text-zinc-400 mb-1 uppercase tracking-wide">{metricLabel(key)}</div>
                      <div className={`text-2xl font-mono tabular-nums ${metricColor(key, value)}`}>
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
                totalGames = Math.max(totalGames, entry.metrics["games_played:count"] ?? 0);
                Object.entries(entry.metrics).forEach(([k, v]) => {
                  mergedMetrics[k] = v;
                });
              });
              const metricEntries = Object.entries(mergedMetrics);

              return (
                <div key={challengeType} className="border border-zinc-900 p-6">
                  <div className="flex items-baseline justify-between mb-4">
                    <h2 className="text-sm font-semibold text-zinc-900">{challengeType}</h2>
                    <span className="text-xs text-zinc-400 tabular-nums">{totalGames} games</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {metricEntries.map(([key, value]) => (
                      <div key={key} className="flex items-baseline justify-between">
                        <span className="text-xs text-zinc-500">{metricLabel(key)}</span>
                        <span className={`text-sm font-mono tabular-nums ${metricColor(key, value)}`}>
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
      {challenges.length > 0 ? (
        <ChallengesList
          challenges={challenges}
          challengeType=""
          profiles={profiles}
        />
      ) : (
        <div className="border border-zinc-900 p-8 text-center">
          <p className="text-zinc-600">No challenges found for this user.</p>
        </div>
      )}
    </section>
  );
}
