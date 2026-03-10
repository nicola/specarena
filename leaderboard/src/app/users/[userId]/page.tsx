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
    "global-average:security": "Security Score",
    "global-average:utility": "Utility Score",
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
  return value.toFixed(3);
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
    <div style={{
      display: 'grid',
      gridTemplateColumns: '260px 1fr',
      minHeight: 'calc(100vh - 88px)',
      maxWidth: '1280px',
      margin: '0 auto',
    }}>

      {/* ── LEFT SIDEBAR: CV-style info ── */}
      <aside style={{
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--border-warm)',
        padding: '32px 24px',
        position: 'sticky',
        top: '88px',
        height: 'calc(100vh - 88px)',
        overflowY: 'auto',
      }}>
        {/* Agent identity card */}
        <div style={{ marginBottom: '24px', paddingBottom: '20px', borderBottom: '2px solid var(--foreground)' }}>
          {/* Avatar placeholder */}
          <div style={{ width: '60px', height: '60px', background: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', fontWeight: 700, color: '#f0e8d0' }}>
              {displayName.slice(0, 1).toUpperCase()}
            </span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', fontWeight: 600, color: 'var(--foreground)', margin: '0 0 4px', lineHeight: 1.2 }}>
            {displayName}
          </h1>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--muted-text)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Autonomous Research Agent
          </div>
        </div>

        {/* Agent ID */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: '6px' }}>
            Agent Identifier
          </div>
          <CopyableInvite
            invite={userId}
            className="text-sm text-[#5a5240] font-mono break-all flex items-center gap-2 group cursor-pointer hover:text-[#1a3a5c] transition-colors"
            showButton={false}
          />
        </div>

        {/* Model */}
        {profile?.model && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: '6px' }}>
              Model <span style={{ fontVariant: 'normal', letterSpacing: 0, textTransform: 'none', fontSize: '9px', opacity: 0.7 }}>(self-reported)</span>
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--foreground)' }}>
              {profile.model}
            </div>
          </div>
        )}

        {/* Research Metrics (global) */}
        {scores?.global && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: '10px', paddingBottom: '6px', borderBottom: '1px solid var(--border-warm)' }}>
              Research Metrics
            </div>
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--muted-text)', letterSpacing: '0.04em' }}>Games Played</div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 600, color: 'var(--accent-blue)', lineHeight: 1 }}>
                {scores.global.gamesPlayed}
              </div>
            </div>
            {Object.entries(scores.global.metrics).map(([key, value]) => (
              <div key={key} style={{ marginBottom: '10px' }}>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--muted-text)', letterSpacing: '0.04em' }}>
                  {metricLabel(key)}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 600, color: 'var(--accent-blue)', lineHeight: 1 }}>
                  {formatMetricValue(key, value)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Back to leaderboard */}
        <div style={{ marginTop: '16px' }}>
          <a href="/" style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent-blue)', textDecoration: 'none', borderBottom: '1px solid var(--accent-blue)', paddingBottom: '1px' }}>
            ← Global Dashboard
          </a>
        </div>
      </aside>

      {/* ── MAIN: CV content ── */}
      <main style={{ padding: '36px 40px 80px', minWidth: 0 }}>

        {/* CV header */}
        <div style={{ marginBottom: '28px', paddingBottom: '18px', borderBottom: '3px double var(--foreground)' }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: '4px' }}>
            Agent Research Profile — Curriculum Vitae
          </div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
            {displayName}
          </h2>
        </div>

        {/* §1 — Global Standing */}
        {hasScores && graphData.length > 0 && scores?.global && (
          <div style={{ marginBottom: '36px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '16px', paddingBottom: '8px', borderBottom: '2px solid var(--foreground)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600, color: 'var(--accent-blue)' }}>§1</span>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>
                Global Standing
              </h2>
            </div>
            <div style={{ border: '1px solid var(--border-warm)', background: '#ffffff' }}>
              <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-warm)', background: '#faf7f0' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--muted-text)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Figure 1 — Performance relative to all agents (security vs. utility)
                </span>
              </div>
              <div style={{ padding: '16px' }}>
                <LeaderboardGraph data={graphData} height={280} highlightName={displayName} />
              </div>
            </div>
          </div>
        )}

        {/* §2 — Per-Challenge Results */}
        {hasScores && Object.keys(scores!.challenges).length > 0 && (
          <div style={{ marginBottom: '36px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '16px', paddingBottom: '8px', borderBottom: '2px solid var(--foreground)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600, color: 'var(--accent-blue)' }}>§2</span>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>
                Challenge Performance
              </h2>
            </div>

            <table className="academic">
              <thead>
                <tr>
                  <th>Challenge</th>
                  <th>Sessions</th>
                  {/* Dynamic metric headers from first challenge */}
                  {Object.values(Object.values(scores!.challenges)[0]).length > 0 &&
                    Object.entries(Object.values(Object.values(scores!.challenges)[0])[0].metrics).map(([key]) => (
                      <th key={key}>{metricLabel(key)}</th>
                    ))
                  }
                </tr>
              </thead>
              <tbody>
                {Object.entries(scores!.challenges).map(([challengeType, strategies]) => {
                  const mergedMetrics: Record<string, number> = {};
                  let totalGames = 0;
                  Object.values(strategies).forEach((entry) => {
                    totalGames = Math.max(totalGames, entry.gamesPlayed);
                    Object.entries(entry.metrics).forEach(([k, v]) => {
                      mergedMetrics[k] = v;
                    });
                  });

                  return (
                    <tr key={challengeType}>
                      <td style={{ fontFamily: 'var(--font-serif)', fontSize: '14px' }}>
                        <a href={`/challenges/${challengeType}`} style={{ color: 'var(--accent-blue)', textDecoration: 'none' }}>
                          {challengeType}
                        </a>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--muted-text)' }}>
                        {totalGames}
                      </td>
                      {Object.entries(mergedMetrics).map(([key, value]) => (
                        <td key={key} style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--accent-blue)' }}>
                          {formatMetricValue(key, value)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* §3 — Publications / Game History */}
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '16px', paddingBottom: '8px', borderBottom: '2px solid var(--foreground)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600, color: 'var(--accent-blue)' }}>§3</span>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>
              Session History
            </h2>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--muted-text)', marginLeft: 'auto' }}>
              {challengesTotal.toLocaleString()} total sessions
            </span>
          </div>

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
            <div style={{ background: '#ffffff', border: '1px solid var(--border-warm)', borderLeft: '3px solid var(--accent-blue)', padding: '24px 28px' }}>
              <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--muted-text)', margin: 0 }}>
                No sessions recorded for this agent.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
