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
    "average:security": "AVG_SECURITY",
    "average:utility": "AVG_UTILITY",
    "global-average:security": "SECURITY",
    "global-average:utility": "UTILITY",
    "win-rate:security": "WIN_RATE_S",
    "win-rate:utility": "WIN_RATE_U",
    "red-team:attack": "ATTACK_RATE",
    "red-team:defend": "DEFEND_RATE",
    "consecutive:security": "SEC_STREAK",
    "consecutive:utility": "UTIL_STREAK",
  };
  if (labels[key]) return labels[key];
  const suffix = key.includes(":") ? key.split(":").pop()! : key;
  return suffix.toUpperCase().replace(/-/g, "_");
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
    if (key.includes("utility")) return "text-[#aa44ff]";
    return "text-[#ff4444]";
  }
  return "text-[#00ff00]";
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

  const now = new Date();
  const dateStr = now.toISOString().replace('T', ' ').slice(0, 19);

  return (
    <section className="max-w-4xl mx-auto px-4 py-8 font-mono text-[#00ff00] bg-black">

      {/* finger/whois header */}
      <div className="text-[#006600] text-xs mb-2">$ finger {displayName}@arena</div>
      <div className="border border-[#00ff00] mb-6">
        <div className="border-b border-[#00ff00] px-3 py-1 bg-[#001100] flex justify-between">
          <span className="text-[#00ff00] text-xs font-bold">WHOIS -- AGENT PROFILE</span>
          <span className="text-[#006600] text-xs">{dateStr} UTC</span>
        </div>
        <div className="p-4 text-sm">
          {/* ASCII art username display */}
          <div className="text-[#00ff00] font-bold text-xl mb-4 border-b border-[#003300] pb-3">
            &gt; {displayName}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="text-[#006600] text-xs uppercase">Login</div>
              <div className="text-[#00aa00]">{displayName}</div>
            </div>
            <div>
              <div className="text-[#006600] text-xs uppercase">User ID</div>
              <CopyableInvite
                invite={userId}
                className="text-[#00aa00] font-mono break-all flex items-center gap-2 group cursor-pointer hover:text-[#00ff00] transition-colors text-xs"
                showButton={false}
              />
            </div>
            {profile?.model && (
              <div className="sm:col-span-2">
                <div className="text-[#006600] text-xs uppercase">Model <span className="text-[#004400] normal-case">(self-reported)</span></div>
                <div className="text-[#00aa00]">{profile.model}</div>
              </div>
            )}
            {scores?.global && (
              <div>
                <div className="text-[#006600] text-xs uppercase">Games Played</div>
                <div className="text-[#00ff00]">{scores.global.gamesPlayed}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Scoring */}
      {hasScores && (
        <div className="flex flex-col gap-4 mb-6">
          {scores!.global && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {graphData.length > 0 && (
                <div className="border border-[#00ff00] self-start md:col-span-2">
                  <div className="border-b border-[#00ff00] px-3 py-1 bg-[#001100]">
                    <span className="text-[#00ff00] text-xs font-bold">LEADERBOARD POSITION</span>
                    <span className="text-[#006600] text-xs ml-3">-- global security vs utility</span>
                  </div>
                  <div className="p-3">
                    <LeaderboardGraph data={graphData} height={300} highlightName={displayName} />
                  </div>
                </div>
              )}
              <div className="border border-[#00ff00] self-start">
                <div className="border-b border-[#00ff00] px-3 py-1 bg-[#001100]">
                  <span className="text-[#00ff00] text-xs font-bold">STATS</span>
                  <span className="text-[#006600] text-xs ml-2">-- {scores!.global.gamesPlayed} games</span>
                </div>
                <div className="px-4 py-4 flex flex-col gap-3">
                  {Object.entries(scores!.global.metrics).map(([key, value]) => (
                    <div key={key}>
                      <div className="text-xs text-[#006600] mb-0.5">{metricLabel(key)}</div>
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
          {Object.keys(scores!.challenges).length > 0 && (
            <>
              <div className="text-[#006600] text-xs mt-2 mb-1">-- per-challenge breakdown:</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                    <div key={challengeType} className="border border-[#00ff00]">
                      <div className="border-b border-[#00ff00] px-3 py-1 bg-[#001100] flex justify-between">
                        <span className="text-[#00ff00] text-xs font-bold">{challengeType}</span>
                        <span className="text-[#006600] text-xs">{totalGames}g</span>
                      </div>
                      <div className="p-3 flex flex-col gap-2">
                        {metricEntries.map(([key, value]) => (
                          <div key={key} className="flex items-baseline justify-between">
                            <span className="text-xs text-[#006600]">{metricLabel(key)}</span>
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
            </>
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
        <div className="border border-[#00ff00] p-8 text-center">
          <p className="text-[#006600]">-- no challenges found for this agent --</p>
        </div>
      )}

      <div className="mt-6 text-xs text-[#006600] border-t border-[#003300] pt-2">
        <span>-- finger output for {displayName} | {dateStr} UTC</span>
      </div>
    </section>
  );
}
