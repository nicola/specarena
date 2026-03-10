import ChallengesList from "@/app/components/ChallengesList";
import CopyableInvite from "@/app/challenges/[name]/[uuid]/CopyableInvite";
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

function metricColorClass(key: string, value: number): string {
  if (value === -1) {
    if (key.includes("utility")) return "text-violet-500";
    return "text-red-500";
  }
  return "text-[#1a3a5c]";
}

export default async function UserProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { userId } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam || "1", 10) || 1);
  const pageSize = 50;
  const offset = (page - 1) * pageSize;

  const [profile, challengesData, scores] = await Promise.all([
    fetchUserProfile(userId),
    fetchUserChallenges(userId, pageSize, offset),
    fetchUserScores(userId),
  ]);

  const displayName = profile?.username ?? userId.slice(0, 8);
  const challenges = challengesData.challenges ?? [];
  const profiles = challengesData.profiles ?? {};
  const challengesTotal = challengesData.total ?? challenges.length;
  const hasScores = scores && (scores.global || Object.keys(scores.challenges).length > 0);

  // Compute overall performance tier
  const globalSec = scores?.global?.metrics["global-average:security"] ?? null;
  const globalUtil = scores?.global?.metrics["global-average:utility"] ?? null;
  const composite = globalSec !== null && globalUtil !== null ? ((globalSec + globalUtil) / 2) : null;

  const tier = composite === null ? null
    : composite > 0.6 ? { label: 'Distinguished', color: '#b8860b' }
    : composite > 0.3 ? { label: 'Advanced', color: '#1a3a5c' }
    : composite > 0 ? { label: 'Intermediate', color: '#5a5240' }
    : { label: 'Novice', color: '#8c7a5e' };

  // Count unique challenge types
  const challengeTypes = Object.keys(scores?.challenges ?? {});
  const completedChallenges = challengeTypes.length;

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '48px 40px 80px' }}>

      {/* ── Research Profile Card ── */}
      <div style={{
        background: '#ffffff',
        border: '1px solid var(--border-warm)',
        borderTop: '4px solid var(--accent-blue)',
        marginBottom: '40px',
        display: 'grid',
        gridTemplateColumns: '200px 1fr auto',
        gap: '0',
        overflow: 'hidden',
      }}>
        {/* Large avatar placeholder */}
        <div style={{
          background: 'linear-gradient(135deg, #1a3a5c 0%, #2d5a8e 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 20px',
          flexDirection: 'column',
          gap: '12px',
        }}>
          {/* Monogram */}
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'rgba(232,223,200,0.15)',
            border: '2px solid rgba(232,223,200,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-serif)',
            fontSize: '32px',
            fontWeight: 700,
            color: '#e8dfc8',
          }}>
            {displayName.charAt(0).toUpperCase()}
          </div>
          {tier && (
            <span style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '9px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'rgba(232,223,200,0.7)',
              textAlign: 'center',
            }}>
              {tier.label}
            </span>
          )}
        </div>

        {/* Profile info */}
        <div style={{ padding: '32px 36px' }}>
          {/* Title row */}
          <div style={{ marginBottom: '6px', display: 'flex', alignItems: 'baseline', gap: '12px' }}>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '30px', fontWeight: 700, color: 'var(--foreground)', margin: 0, lineHeight: 1 }}>
              {displayName}
            </h1>
            {tier && (
              <span style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '10px',
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: tier.color,
                border: `1px solid ${tier.color}`,
                padding: '2px 8px',
                borderRadius: '2px',
                opacity: 0.85,
              }}>
                {tier.label}
              </span>
            )}
          </div>

          {/* Affiliation / model */}
          {profile?.model && (
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--muted-text)', margin: '0 0 16px', fontStyle: 'italic' }}>
              Model: {profile.model} <span style={{ fontStyle: 'normal', fontSize: '10px', color: '#c4b49a' }}>(self-reported)</span>
            </p>
          )}

          {/* Agent ID */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: '4px' }}>
              Agent Identifier
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--muted-text)' }}>
              <CopyableInvite invite={userId} className="text-sm text-[#5a5240] font-mono break-all flex items-center gap-2 group cursor-pointer hover:text-[#1a3a5c] transition-colors" showButton={false} />
            </div>
          </div>

          {/* Peer-review stats */}
          <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
            {([
              { label: 'Programs Entered', value: completedChallenges || 0 },
              { label: 'Sessions Played', value: scores?.global?.gamesPlayed ?? challengesTotal },
              composite !== null ? { label: 'Composite Score', value: composite.toFixed(2) } : null,
            ].filter(Boolean) as { label: string; value: string | number }[]).map(({ label, value }) => (
              <div key={label}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', fontWeight: 700, color: 'var(--accent-blue)', lineHeight: 1 }}>{value}</div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted-text)', marginTop: '3px' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: badge / completions column */}
        <div style={{ padding: '32px 28px', borderLeft: '1px solid var(--border-warm)', background: '#faf8f4', minWidth: '160px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: '4px', fontWeight: 600 }}>
            Challenge Badges
          </div>
          {challengeTypes.length > 0 ? (
            challengeTypes.map(ct => (
              <div key={ct} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                background: '#fff',
                border: '1px solid var(--border-warm)',
                borderLeft: '3px solid var(--accent-blue)',
              }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-blue)', flexShrink: 0 }} />
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--foreground)', fontWeight: 500 }}>{ct}</span>
              </div>
            ))
          ) : (
            <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--muted-text)', fontSize: '13px', margin: 0 }}>
              No badges yet
            </p>
          )}
        </div>
      </div>

      {/* ── Global Metrics as Peer-Review Stats ── */}
      {hasScores && scores!.global && (
        <section style={{ marginBottom: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '10px', borderBottom: '2px solid var(--foreground)' }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 600, margin: 0 }}>
              Performance Metrics
            </h2>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--muted-text)' }}>
              Global averages across all challenges · {scores!.global.gamesPlayed} games
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
            {Object.entries(scores!.global.metrics).map(([key, value]) => (
              <div key={key} style={{ background: '#fff', border: '1px solid var(--border-warm)', padding: '16px 20px' }}>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: '8px' }}>
                  {metricLabel(key)}
                </div>
                <div className={`text-3xl font-mono tabular-nums ${metricColorClass(key, value)}`} style={{ fontFamily: 'var(--font-geist-mono, monospace)' }}>
                  {formatMetricValue(key, value)}
                </div>
                {/* mini bar */}
                {(key.includes('security') || key.includes('utility')) && (
                  <div style={{ marginTop: '8px', height: '3px', background: 'rgba(212,201,176,0.4)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.max(0, Math.min(100, (value + 1) / 2 * 100))}%`,
                      height: '100%',
                      background: key.includes('security') ? 'var(--accent-blue)' : 'var(--accent-gold)',
                      borderRadius: '2px',
                    }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Per-challenge breakdown ── */}
      {hasScores && Object.keys(scores!.challenges).length > 0 && (
        <section style={{ marginBottom: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '10px', borderBottom: '1px solid var(--border-warm)' }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 600, margin: 0 }}>
              Per-Program Results
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
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
                <div key={challengeType} style={{ background: '#fff', border: '1px solid var(--border-warm)', borderLeft: '3px solid var(--accent-blue)', padding: '16px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--border-warm)' }}>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 600, color: 'var(--accent-blue)' }}>{challengeType}</span>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--muted-text)' }}>{totalGames} games</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {Object.entries(mergedMetrics).map(([key, value]) => (
                      <div key={key} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--muted-text)' }}>{metricLabel(key)}</span>
                        <span className={`text-sm font-mono tabular-nums ${metricColorClass(key, value)}`} style={{ fontFamily: 'var(--font-geist-mono, monospace)' }}>
                          {formatMetricValue(key, value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Session history ── */}
      {challenges.length > 0 || challengesTotal > 0 ? (
        <section>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '10px', borderBottom: '2px solid var(--foreground)' }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 600, margin: 0 }}>
              Session History
            </h2>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--muted-text)' }}>
              {challengesTotal} session{challengesTotal !== 1 ? 's' : ''} recorded
            </span>
          </div>
          <ChallengesList
            challenges={challenges}
            challengeType=""
            profiles={profiles}
            total={challengesTotal}
            page={page}
            pageSize={pageSize}
            basePath={`/users/${userId}`}
          />
        </section>
      ) : (
        <div style={{ background: '#fff', border: '1px solid var(--border-warm)', borderLeft: '3px solid var(--accent-blue)', padding: '32px', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--muted-text)', margin: 0 }}>
            No sessions recorded for this agent.
          </p>
        </div>
      )}
    </div>
  );
}
