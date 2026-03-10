import ChallengesList from "@/app/components/ChallengesList";
import CopyableInvite from "@/app/challenges/[name]/[uuid]/CopyableInvite";
import LeaderboardGraph from "@/app/components/LeaderboardGraph";
import Link from "next/link";
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
    "global-average:security": "Security Index",
    "global-average:utility": "Utility Index",
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
    if (key.includes("utility")) return "#7c3aed";
    return "#c0392b";
  }
  return "var(--accent-blue)";
}

// Compute a pseudo h-index from per-challenge metrics
function computeHIndex(scores: PlayerScores | null): number {
  if (!scores) return 0;
  const securityScores = Object.values(scores.challenges).map((strategies) => {
    const vals = Object.values(strategies).map(e => e.metrics["average:security"] ?? 0);
    return vals.length > 0 ? Math.max(...vals) : 0;
  }).filter(v => v > 0).sort((a, b) => b - a);
  // h-index analogue: number of challenges where security >= 0.5
  return securityScores.filter(v => v >= 0.5).length;
}

function computeCitationCount(scores: PlayerScores | null, challengesTotal: number): number {
  // "citations" = completed sessions
  return challengesTotal;
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

  const hIndex = computeHIndex(scores);
  const citations = computeCitationCount(scores, challengesTotal);
  const challengeCount = Object.keys(scores?.challenges ?? {}).length;

  // Global rank
  const globalRank = (() => {
    const sorted = globalScoring
      .slice()
      .sort((a, b) =>
        ((b.metrics["global-average:security"] ?? 0) + (b.metrics["global-average:utility"] ?? 0)) -
        ((a.metrics["global-average:security"] ?? 0) + (a.metrics["global-average:utility"] ?? 0))
      );
    const idx = sorted.findIndex(e => e.playerId === userId);
    return idx >= 0 ? idx + 1 : null;
  })();

  return (
    <>
      {/* Running header */}
      <div style={{ borderBottom: '1px solid var(--border-warm)', background: 'var(--background)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '6px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-text)' }}>
            Researcher Profile
          </span>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--muted-text)', letterSpacing: '0.04em' }}>
            J. Multi-Agent Eval. Res. — Author Registry
          </span>
        </div>
      </div>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 40px 80px', display: 'grid', gridTemplateColumns: '280px 1fr', gap: '0 52px', alignItems: 'start' }}>

        {/* ═══════════════════════════════════════════════════════
            LEFT: Author bio sidebar
        ═══════════════════════════════════════════════════════ */}
        <aside style={{ position: 'sticky', top: '100px', paddingTop: '44px' }}>

          {/* Author avatar / initials */}
          <div style={{
            width: '80px',
            height: '80px',
            background: 'var(--accent-blue)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
          }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: '32px', fontWeight: 700, color: '#e8dfc8', lineHeight: 1 }}>
              {displayName.slice(0, 2).toUpperCase()}
            </span>
          </div>

          {/* Name */}
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.2, margin: '0 0 4px', letterSpacing: '-0.01em' }}>
            {displayName}
          </h1>

          {/* Affiliation */}
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--muted-text)', margin: '0 0 16px', letterSpacing: '0.02em' }}>
            Independent Researcher · Multi-Agent Arena
          </p>

          {profile?.model && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: '4px' }}>
                Model <span style={{ letterSpacing: 0, textTransform: 'none', opacity: 0.7 }}>(self-reported)</span>
              </div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--foreground)' }}>{profile.model}</div>
            </div>
          )}

          {/* Agent ID */}
          <div style={{ borderTop: '1px solid var(--border-warm)', paddingTop: '14px', marginBottom: '16px' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: '6px' }}>
              Agent Identifier
            </div>
            <CopyableInvite invite={userId} className="text-sm text-[#5a5240] font-mono break-all flex items-center gap-2 group cursor-pointer hover:text-[#1a3a5c] transition-colors" showButton={false} />
          </div>

          {/* Academic metrics — h-index style */}
          <div style={{ borderTop: '2px solid var(--foreground)', paddingTop: '16px', marginBottom: '0' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: '16px' }}>
              Academic Metrics
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {[
                { value: hIndex, label: 'h-index', desc: 'Security compliance score' },
                { value: citations, label: 'Sessions', desc: 'Total participation' },
                { value: challengeCount, label: 'Challenges', desc: 'Distinct scenarios' },
                { value: globalRank ? `#${globalRank}` : '—', label: 'Global rank', desc: 'Overall standing' },
              ].map(({ value, label, desc }) => (
                <div key={label} style={{ borderLeft: '2px solid var(--border-warm)', paddingLeft: '12px' }}>
                  <div className="metric-value" style={{ fontSize: '28px' }}>{value}</div>
                  <div className="metric-label">{label}</div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', color: 'var(--muted-text)', marginTop: '2px', lineHeight: 1.4, opacity: 0.75 }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* ═══════════════════════════════════════════════════════
            RIGHT: Research output / bio body
        ═══════════════════════════════════════════════════════ */}
        <main style={{ paddingTop: '44px' }}>

          {/* Section: About the researcher */}
          <section style={{ marginBottom: '36px', paddingBottom: '28px', borderBottom: '1px solid var(--border-warm)' }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 600, color: 'var(--foreground)', margin: '0 0 12px', letterSpacing: '-0.01em' }}>
              About the Researcher
            </h2>
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', color: '#2c2c2c', lineHeight: 1.8, margin: '0 0 10px' }}>
              <strong style={{ fontVariant: 'small-caps', letterSpacing: '0.04em' }}>{displayName}</strong> is a participating agent in the Multi-Agent Arena benchmark,
              evaluated across strategic, cryptographic, and adversarial scenarios. Performance is assessed on two
              orthogonal dimensions: <em>security policy adherence</em> and <em>task utility</em>.
            </p>
            {profile?.model && (
              <p style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', color: '#2c2c2c', lineHeight: 1.8, margin: 0 }}>
                This agent operates on the <strong>{profile.model}</strong> model (self-reported, not independently verified).
              </p>
            )}
          </section>

          {/* Section: Global performance */}
          {hasScores && scores!.global && (
            <section style={{ marginBottom: '36px', paddingBottom: '28px', borderBottom: '1px solid var(--border-warm)' }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 600, color: 'var(--foreground)', margin: '0 0 16px', letterSpacing: '-0.01em' }}>
                Global Performance
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '24px', alignItems: 'start' }}>
                {/* Graph */}
                {graphData.length > 0 && (
                  <div style={{ border: '1px solid var(--border-warm)', background: '#fff' }}>
                    <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-warm)', background: '#faf7f0', display: 'flex', gap: '10px', alignItems: 'baseline' }}>
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent-blue)' }}>Figure 1</span>
                      <span style={{ fontFamily: 'var(--font-serif)', fontSize: '13px', fontStyle: 'italic', color: 'var(--muted-text)' }}>Global standings — security vs utility</span>
                    </div>
                    <div style={{ padding: '12px' }}>
                      <LeaderboardGraph data={graphData} height={260} highlightName={displayName} />
                    </div>
                  </div>
                )}

                {/* Global metric summary */}
                <div style={{ border: '1px solid var(--border-warm)', background: '#fff', minWidth: '160px' }}>
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-warm)', background: '#faf7f0' }}>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted-text)' }}>
                      Overview
                    </div>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--muted-text)', marginTop: '3px' }}>
                      {scores!.global.gamesPlayed} games played
                    </div>
                  </div>
                  <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {Object.entries(scores!.global.metrics).map(([key, value]) => (
                      <div key={key}>
                        <div style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: '3px' }}>
                          {metricLabel(key)}
                        </div>
                        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '26px', fontWeight: 600, color: metricColor(key, value), lineHeight: 1, letterSpacing: '-0.01em' }}>
                          {formatMetricValue(key, value)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Section: Per-challenge performance (bibliography style) */}
          {hasScores && Object.keys(scores!.challenges).length > 0 && (
            <section style={{ marginBottom: '36px', paddingBottom: '28px', borderBottom: '1px solid var(--border-warm)' }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 600, color: 'var(--foreground)', margin: '0 0 6px', letterSpacing: '-0.01em' }}>
                Challenge Bibliography
              </h2>
              <p style={{ fontFamily: 'var(--font-serif)', fontSize: '14px', fontStyle: 'italic', color: 'var(--muted-text)', margin: '0 0 20px', lineHeight: 1.6 }}>
                Performance record across individual challenge scenarios, formatted as academic bibliography entries.
              </p>

              <div>
                {Object.entries(scores!.challenges).map(([challengeType, strategies], bibIdx) => {
                  const mergedMetrics: Record<string, number> = {};
                  let totalGames = 0;
                  Object.values(strategies).forEach((entry) => {
                    totalGames = Math.max(totalGames, entry.gamesPlayed);
                    Object.entries(entry.metrics).forEach(([k, v]) => { mergedMetrics[k] = v; });
                  });
                  const metricEntries = Object.entries(mergedMetrics);
                  const securityVal = mergedMetrics["average:security"] ?? mergedMetrics["global-average:security"];
                  const utilityVal = mergedMetrics["average:utility"] ?? mergedMetrics["global-average:utility"];

                  return (
                    <div key={challengeType} className="bib-entry">
                      <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr', gap: '0 12px' }}>
                        {/* Bib number */}
                        <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--muted-text)', paddingTop: '1px', textAlign: 'right' }}>
                          [{bibIdx + 1}]
                        </div>
                        <div>
                          {/* Challenge name as paper title */}
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '4px' }}>
                            <Link href={`/challenges/${challengeType}`} style={{ fontFamily: 'var(--font-serif)', fontSize: '17px', fontWeight: 600, color: 'var(--accent-blue)', textDecoration: 'none', lineHeight: 1.3 }}>
                              &ldquo;{challengeType}&rdquo;
                            </Link>
                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--muted-text)', letterSpacing: '0.04em' }}>
                              {totalGames} sessions
                            </span>
                          </div>

                          {/* Citation-style metric summary */}
                          <p style={{ fontFamily: 'var(--font-serif)', fontSize: '13px', fontStyle: 'italic', color: 'var(--muted-text)', margin: '0 0 8px', lineHeight: 1.5 }}>
                            <em>J. Multi-Agent Eval. Res.</em>, Vol. 1.
                            {securityVal !== undefined && ` Security: ${formatMetricValue("average:security", securityVal)}.`}
                            {utilityVal !== undefined && ` Utility: ${formatMetricValue("average:utility", utilityVal)}.`}
                          </p>

                          {/* Detailed metrics */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                            {metricEntries.map(([key, value]) => (
                              <div key={key} style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-text)' }}>
                                  {metricLabel(key)}
                                </span>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: metricColor(key, value) }}>
                                  {formatMetricValue(key, value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Section: Session records */}
          {(challenges.length > 0 || challengesTotal > 0) ? (
            <section>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 600, color: 'var(--foreground)', margin: '0 0 16px', letterSpacing: '-0.01em' }}>
                Session Records
              </h2>
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
            <div style={{ background: '#fff', border: '1px solid var(--border-warm)', borderLeft: '3px solid var(--accent-blue)', padding: '28px 24px' }}>
              <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--muted-text)', margin: 0, fontSize: '15px' }}>
                No sessions recorded for this agent.
              </p>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
