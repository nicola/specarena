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
    "global-average:security": "Security 安全",
    "global-average:utility": "Utility 实用",
    "win-rate:security": "Win Rate (S)",
    "win-rate:utility": "Win Rate (U)",
    "red-team:attack": "Attack Rate 攻击率",
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
    if (key.includes("utility")) return "#9c27b0";
    return "#e53935";
  }
  if (key.includes("security")) return "#0052cc";
  if (key.includes("utility")) return "#e53935";
  return "#333333";
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

  const sectionStyle = {
    background: '#ffffff',
    border: '1px solid #e8e8e8',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 16,
  };

  const sectionHeaderStyle = {
    padding: '10px 16px',
    background: '#fafafa',
    borderBottom: '1px solid #e8e8e8',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  };

  return (
    <section style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{
        paddingBottom: 16,
        borderBottom: '1px solid #e8e8e8',
        marginBottom: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{ width: 4, height: 20, background: '#e53935', borderRadius: 2 }} />
          <h1 style={{
            fontSize: 20,
            fontWeight: 700,
            color: '#333333',
            margin: 0,
            fontFamily: '-apple-system, "PingFang SC", sans-serif',
          }}>
            智能体 Agent <span style={{ color: '#e53935' }}>{displayName}</span>
          </h1>
        </div>
      </div>

      {/* Profile info card */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <div style={{ width: 3, height: 14, background: '#e53935', borderRadius: 1 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>基本信息 Profile</span>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: '#aaa', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>用户 ID / User ID</div>
            <CopyableInvite
              invite={userId}
              className="text-sm text-zinc-400 font-mono break-all flex items-center gap-2 group cursor-pointer hover:text-zinc-600 transition-colors"
              showButton={false}
            />
          </div>
          {profile?.model && (
            <div>
              <div style={{ fontSize: 11, color: '#aaa', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                模型 Model <span style={{ textTransform: 'none', fontSize: 10, color: '#ccc' }}>(self-reported, not verified)</span>
              </div>
              <div style={{ fontSize: 13, color: '#555' }}>{profile.model}</div>
            </div>
          )}
        </div>
      </div>

      {/* Scoring */}
      {hasScores && (
        <div style={{ marginBottom: 16 }}>
          {scores!.global && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: graphData.length > 0 ? '2fr 1fr' : '1fr',
              gap: 16,
              marginBottom: 16,
            }}>
              {graphData.length > 0 && (
                <div style={sectionStyle}>
                  <div style={sectionHeaderStyle}>
                    <div style={{ width: 3, height: 14, background: '#e53935', borderRadius: 1 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>全球排行榜 Leaderboard</span>
                  </div>
                  <div style={{ padding: '8px 4px 4px' }}>
                    <LeaderboardGraph data={graphData} height={300} highlightName={displayName} />
                  </div>
                </div>
              )}
              <div style={sectionStyle}>
                <div style={sectionHeaderStyle}>
                  <div style={{ width: 3, height: 14, background: '#0052cc', borderRadius: 1 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>总览 Overview</span>
                  <span style={{ fontSize: 11, color: '#aaa', marginLeft: 4 }}>{scores!.global.gamesPlayed} games</span>
                </div>
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {Object.entries(scores!.global.metrics).map(([key, value]) => (
                    <div key={key}>
                      <div style={{ fontSize: 10, color: '#aaa', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {metricLabel(key)}
                      </div>
                      <div style={{
                        fontSize: 26,
                        fontFamily: 'monospace',
                        fontVariantNumeric: 'tabular-nums',
                        fontWeight: 700,
                        color: metricColor(key, value),
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
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 12,
              marginBottom: 16,
            }}>
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
                  <div key={challengeType} style={{
                    background: '#ffffff',
                    border: '1px solid #e8e8e8',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      padding: '8px 14px',
                      background: '#fafafa',
                      borderBottom: '1px solid #e8e8e8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#333' }}>{challengeType}</span>
                      <span style={{ fontSize: 10, color: '#bbb', fontFamily: 'monospace' }}>{totalGames} games</span>
                    </div>
                    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {metricEntries.map(([key, value]) => (
                        <div key={key} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 11, color: '#888' }}>{metricLabel(key)}</span>
                          <span style={{
                            fontSize: 13,
                            fontFamily: 'monospace',
                            fontVariantNumeric: 'tabular-nums',
                            fontWeight: 600,
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
        <div style={{
          background: '#ffffff',
          border: '1px solid #e8e8e8',
          padding: '40px 24px',
          textAlign: 'center',
          borderRadius: 2,
        }}>
          <p style={{ color: '#bbb', fontSize: 13 }}>暂无对局记录 — No challenges found.</p>
        </div>
      )}
    </section>
  );
}
