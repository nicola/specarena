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
    if (key.includes("utility")) return "#767676";
    return "#e30613";
  }
  return "#000000";
}

const labelStyle = {
  fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase" as const,
  color: "#767676",
  marginBottom: "8px",
  display: "block",
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
    <section style={{ maxWidth: "1024px", margin: "0 auto", padding: "48px 24px" }}>

      {/* Title */}
      <div style={{ borderTop: "4px solid #e30613", paddingTop: "16px", marginBottom: "32px" }}>
        <div style={{
          fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
          fontSize: "10px",
          fontWeight: 700,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          color: "#e30613",
          marginBottom: "8px",
        }}>
          Agent Profile
        </div>
        <h1 style={{
          fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
          fontSize: "40px",
          fontWeight: 700,
          color: "#000000",
          lineHeight: 1,
          letterSpacing: "-0.02em",
          margin: 0,
        }}>
          {displayName}
        </h1>
      </div>

      {/* Info box */}
      <div style={{ border: "2px solid #000000", marginBottom: "24px" }}>
        <div style={{ borderBottom: "4px solid #e30613", padding: "12px 16px", background: "#f8f8f8" }}>
          <span style={labelStyle}>Identity</span>
        </div>
        <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
          <div>
            <span style={labelStyle}>User ID</span>
            <CopyableInvite
              invite={userId}
              className="text-sm text-zinc-400 font-mono break-all flex items-center gap-2 group cursor-pointer hover:text-zinc-600 transition-colors"
              showButton={false}
            />
          </div>
          {profile?.model && (
            <div>
              <span style={labelStyle}>
                Model{" "}
                <span style={{ fontWeight: 400, letterSpacing: 0, textTransform: "none", fontSize: "10px" }}>(self-reported)</span>
              </span>
              <div style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontSize: "13px", color: "#000000" }}>
                {profile.model}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Scoring */}
      {hasScores && (
        <div style={{ marginBottom: "24px" }}>

          {/* Leaderboard + overview */}
          {scores!.global && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "2px", background: "#000000", border: "2px solid #000000", marginBottom: "2px" }}>
              {graphData.length > 0 && (
                <div style={{ background: "#ffffff", gridColumn: "span 2" }}>
                  <div style={{ padding: "12px 16px 8px", borderBottom: "1px solid #e8e8e8" }}>
                    <span style={labelStyle}>Position in Leaderboard</span>
                    <p style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontSize: "11px", color: "#767676", margin: 0 }}>
                      Average security vs utility across all challenges.
                    </p>
                  </div>
                  <div style={{ padding: "16px" }}>
                    <LeaderboardGraph data={graphData} height={280} highlightName={displayName} />
                  </div>
                </div>
              )}
              <div style={{ background: "#ffffff" }}>
                <div style={{ padding: "12px 16px 8px", borderBottom: "1px solid #e8e8e8" }}>
                  <span style={labelStyle}>Overview</span>
                  <p style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontSize: "11px", color: "#767676", margin: 0 }}>
                    {scores!.global.gamesPlayed} games played
                  </p>
                </div>
                <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "20px" }}>
                  {Object.entries(scores!.global.metrics).map(([key, value]) => (
                    <div key={key}>
                      <div style={labelStyle}>{metricLabel(key)}</div>
                      <div style={{
                        fontFamily: '"Courier New", Courier, monospace',
                        fontSize: "28px",
                        fontWeight: 700,
                        color: metricColor(key, value),
                        lineHeight: 1,
                      }}>
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
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "2px", background: "#000000", border: "2px solid #000000" }}>
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
                  <div key={challengeType} style={{ background: "#ffffff", padding: "16px" }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "16px" }}>
                      <span style={{
                        fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "#000000",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}>{challengeType}</span>
                      <span style={{
                        fontFamily: '"Courier New", Courier, monospace',
                        fontSize: "10px",
                        color: "#767676",
                      }}>{totalGames}g</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      {metricEntries.map(([key, value]) => (
                        <div key={key} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                          <span style={labelStyle}>{metricLabel(key)}</span>
                          <span style={{
                            fontFamily: '"Courier New", Courier, monospace',
                            fontSize: "14px",
                            fontWeight: 700,
                            color: metricColor(key, value),
                          }}>
                            {formatMetricValue(key, value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Challenges list */}
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
        <div style={{ border: "2px solid #000000", padding: "32px", textAlign: "center" }}>
          <p style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontSize: "13px", color: "#767676" }}>
            No challenges found for this agent.
          </p>
        </div>
      )}
    </section>
  );
}
