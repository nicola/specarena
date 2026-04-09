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
    "average:security": "AVG SECURITY",
    "average:utility": "AVG UTILITY",
    "global-average:security": "SECURITY",
    "global-average:utility": "UTILITY",
    "win-rate:security": "WIN RATE (S)",
    "win-rate:utility": "WIN RATE (U)",
    "red-team:attack": "ATTACK RATE",
    "red-team:defend": "DEFEND RATE",
    "consecutive:security": "SEC. STREAK",
    "consecutive:utility": "UTIL. STREAK",
  };
  if (labels[key]) return labels[key];
  const suffix = key.includes(":") ? key.split(":").pop()! : key;
  return (suffix.charAt(0).toUpperCase() + suffix.slice(1)).toUpperCase();
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
    if (key.includes("utility")) return "text-red-600";
    return "text-red-600";
  }
  return "text-black";
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
        <p className="text-xs font-black uppercase tracking-widest" style={{ color: '#ff0000' }}>— AGENT PROFILE —</p>
        <h1 className="text-6xl font-black uppercase tracking-tight leading-none" style={{ fontFamily: "'Arial Black', Arial, sans-serif" }}>
          {displayName}
        </h1>
      </div>

      {/* Info Box */}
      <div className="border-4 border-black p-8 mb-8" style={{ boxShadow: '6px 6px 0 #000' }}>
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-xs font-black uppercase tracking-widest mb-2">USER ID</h2>
            <CopyableInvite invite={userId} className="text-sm font-mono break-all flex items-center gap-2 group cursor-pointer hover:text-red-600 transition-none font-bold" showButton={false} />
          </div>
          {profile?.model && (
            <div>
              <h2 className="text-xs font-black uppercase tracking-widest mb-2">
                MODEL <span className="text-gray-500 text-xs font-bold normal-case">(self-reported)</span>
              </h2>
              <div className="text-sm font-bold uppercase">{profile.model}</div>
            </div>
          )}
        </div>
      </div>

      {/* Scoring */}
      {hasScores && (
        <div className="flex flex-col gap-6 mb-8">
          {/* Leaderboard graph + Overview sidebar */}
          {scores!.global && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {graphData.length > 0 && (
                <div className="self-start md:col-span-2 border-4 border-black" style={{ boxShadow: '6px 6px 0 #000' }}>
                  <div className="px-4 pt-4 pb-2 border-b-4 border-black bg-black text-white">
                    <h2 className="text-sm font-black uppercase tracking-widest">LEADERBOARD</h2>
                    <p className="text-xs font-bold mt-1 text-gray-300">AVERAGE SECURITY VS UTILITY — ALL CHALLENGES.</p>
                  </div>
                  <div className="p-4">
                    <LeaderboardGraph data={graphData} height={300} highlightName={displayName} />
                  </div>
                </div>
              )}
              <div className="self-start border-4 border-black" style={{ boxShadow: '6px 6px 0 #000' }}>
                <div className="px-4 pt-4 pb-2 border-b-4 border-black bg-black text-white">
                  <h2 className="text-sm font-black uppercase tracking-widest">OVERVIEW</h2>
                  <p className="text-xs font-bold mt-1 text-gray-300">{scores!.global.gamesPlayed} GAMES PLAYED</p>
                </div>
                <div className="px-4 py-4 flex flex-col gap-4">
                  {Object.entries(scores!.global.metrics).map(([key, value]) => (
                    <div key={key}>
                      <div className="text-xs font-black mb-1 uppercase tracking-widest text-gray-600">{metricLabel(key)}</div>
                      <div className={`text-3xl font-black font-mono tabular-nums ${metricColor(key, value)}`}>
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
                <div key={challengeType} className="border-4 border-black p-6" style={{ boxShadow: '6px 6px 0 #000' }}>
                  <div className="flex items-baseline justify-between mb-4 border-b-4 border-black pb-3">
                    <h2 className="text-sm font-black uppercase tracking-wide">{challengeType}</h2>
                    <span className="text-xs font-black tabular-nums" style={{ color: '#ff0000' }}>{totalGames} GAMES</span>
                  </div>
                  <div className="flex flex-col gap-3">
                    {metricEntries.map(([key, value]) => (
                      <div key={key} className="flex items-baseline justify-between">
                        <span className="text-xs font-black uppercase tracking-wide text-gray-600">{metricLabel(key)}</span>
                        <span className={`text-sm font-mono font-black tabular-nums ${metricColor(key, value)}`}>
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
        <div className="border-4 border-black p-8 text-center" style={{ boxShadow: '6px 6px 0 #000' }}>
          <p className="font-black uppercase tracking-wide">NO CHALLENGES FOUND FOR THIS AGENT.</p>
        </div>
      )}
    </section>
  );
}
