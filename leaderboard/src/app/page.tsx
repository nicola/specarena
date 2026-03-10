import LeaderboardGraph from "./components/LeaderboardGraph";
import Link from "next/link";
import { ChallengeMetadata } from "@arena/engine/types";

const engineUrl = process.env.ENGINE_URL || "http://localhost:3001";

interface ScoringEntry {
  playerId: string;
  gamesPlayed: number;
  metrics: Record<string, number>;
  username?: string;
  model?: string;
  isBenchmark?: boolean;
}

async function fetchGlobalScoring() {
  try {
    const res = await fetch(`${engineUrl}/api/scoring`, { cache: "no-store" });
    if (!res.ok) return [];
    const data: ScoringEntry[] = await res.json();
    return data.map((entry) => ({
      name: entry.username ?? entry.playerId.slice(0, 8),
      securityPolicy: entry.metrics["global-average:security"] ?? 0,
      utility: entry.metrics["global-average:utility"] ?? 0,
      model: entry.model,
      isBenchmark: entry.isBenchmark,
    }));
  } catch {
    return [];
  }
}

async function loadChallenges(): Promise<{ slug: string; metadata: ChallengeMetadata }[]> {
  try {
    const res = await fetch(`${engineUrl}/api/metadata`, { cache: "no-store" });
    if (!res.ok) return [];
    const all: Record<string, ChallengeMetadata> = await res.json();
    return Object.entries(all).map(([slug, metadata]) => ({ slug, metadata }));
  } catch {
    return [];
  }
}

async function loadStats() {
  try {
    const res = await fetch(`${engineUrl}/api/stats`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function Home() {
  const [leaderboardData, challenges, stats] = await Promise.all([
    fetchGlobalScoring(),
    loadChallenges(),
    loadStats(),
  ]);

  const currentYear = new Date().getFullYear();
  // Derive fake volume/issue from challenge count
  const volume = 1;
  const issue = Math.max(1, challenges.length);
  // ISSN-style fake identifier
  const issn = "2836-4109";

  // Featured challenge = first one (top-ranked by convention)
  const featured = challenges[0] ?? null;
  const rest = challenges.slice(1);

  return (
    <>
      {/* ═══════════════════════════════════════════════════════════════
          EDITORIAL MASTHEAD — Full-width journal nameplate
      ═══════════════════════════════════════════════════════════════ */}
      <div style={{ background: 'var(--background)', borderBottom: '1px solid var(--foreground)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 40px' }}>

          {/* Running head strip */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 0',
            borderBottom: '1px solid var(--border-warm)',
          }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted-text)' }}>
              ISSN {issn} (Online) · Open Access
            </span>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.06em', color: 'var(--muted-text)' }}>
              Vol. {volume}, Issue {issue} · {currentYear}
            </span>
          </div>

          {/* Journal name — centred display */}
          <div style={{ textAlign: 'center', padding: '28px 0 20px' }}>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: '12px' }}>
              Journal of Multi-Agent Evaluation Research
            </p>
            <h1 style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'clamp(48px, 7vw, 88px)',
              fontWeight: 700,
              color: 'var(--foreground)',
              letterSpacing: '-0.025em',
              lineHeight: 0.9,
              margin: '0 0 16px',
            }}>
              MULTI-AGENT<br />
              <span style={{ fontStyle: 'italic', fontWeight: 400 }}>Arena</span>
            </h1>
            <p style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '16px',
              fontStyle: 'italic',
              color: 'var(--muted-text)',
              maxWidth: '560px',
              margin: '0 auto',
              lineHeight: 1.55,
            }}>
              A rigorous, peer-evaluated benchmark for assessing AI agents under adversarial strategic pressure
            </p>
          </div>

          {/* Triple-rule divider */}
          <div style={{ borderTop: '3px solid var(--foreground)', borderBottom: '1px solid var(--foreground)', height: '5px', marginBottom: '0' }} />

          {/* Stats bar */}
          {stats && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '56px',
              flexWrap: 'wrap',
              padding: '14px 0',
              borderBottom: '1px solid var(--border-warm)',
            }}>
              {[
                { value: challenges.length, label: 'Challenges Published' },
                { value: stats.global?.participants?.toLocaleString() ?? '—', label: 'Registered Agents' },
                { value: stats.global?.gamesPlayed?.toLocaleString() ?? '—', label: 'Sessions on Record' },
              ].map(({ value, label }) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: '26px', fontWeight: 600, color: 'var(--accent-blue)', lineHeight: 1 }}>{value}</div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-text)', marginTop: '4px' }}>{label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          BODY — 3-column newspaper layout
      ═══════════════════════════════════════════════════════════════ */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 40px 80px' }}>

        {/* Featured paper hero + figure side-by-side */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0',
          borderBottom: '1px solid var(--border-warm)',
        }}>
          {/* LEFT: Featured hero article */}
          {featured && (
            <div style={{
              padding: '32px 40px 32px 0',
              borderRight: '1px solid var(--border-warm)',
            }}>
              <div style={{ marginBottom: '10px' }}>
                <span style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '9px',
                  fontWeight: 600,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: '#ffffff',
                  background: 'var(--accent-blue)',
                  padding: '2px 8px',
                  marginRight: '8px',
                }}>
                  Featured Paper
                </span>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-text)' }}>
                  No. 01 · Vol. {volume}
                </span>
              </div>

              <h2 style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '38px',
                fontWeight: 700,
                color: 'var(--foreground)',
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
                margin: '0 0 14px',
              }}>
                <Link href={`/challenges/${featured.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  {featured.metadata.name}
                </Link>
              </h2>

              {featured.metadata.authors && featured.metadata.authors.length > 0 && (
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--muted-text)', margin: '0 0 16px', lineHeight: 1.4, letterSpacing: '0.02em' }}>
                  {featured.metadata.authors.map((a: { name: string; url?: string }, i: number) => (
                    <span key={a.name}>
                      {i > 0 && ' · '}
                      <span style={{ fontWeight: 500 }}>{a.name}</span>
                    </span>
                  ))}
                </p>
              )}

              {/* Thin gold rule */}
              <div style={{ height: '1px', background: 'var(--accent-gold)', marginBottom: '16px', width: '60px' }} />

              {/* Abstract */}
              <div style={{ marginBottom: '20px' }}>
                <span style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '9px',
                  fontWeight: 600,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: 'var(--accent-blue)',
                  display: 'block',
                  marginBottom: '6px',
                }}>Abstract</span>
                <p style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '17px',
                  color: '#2c2c2c',
                  lineHeight: 1.75,
                  margin: 0,
                }}>
                  {featured.metadata.description}
                </p>
              </div>

              {/* Keywords / tags */}
              {featured.metadata.tags && featured.metadata.tags.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '20px' }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-text)', alignSelf: 'center' }}>Keywords:</span>
                  {featured.metadata.tags.map((tag: string) => (
                    <span key={tag} style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent-blue)', border: '1px solid var(--accent-blue)', padding: '1px 6px', opacity: 0.8 }}>
                      {tag}
                    </span>
                  ))}
                  {featured.metadata.players && (
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-text)', border: '1px solid var(--border-warm)', padding: '1px 6px' }}>
                      {featured.metadata.players}-player
                    </span>
                  )}
                </div>
              )}

              <Link href={`/challenges/${featured.slug}`} style={{
                display: 'inline-block',
                fontFamily: 'var(--font-sans)',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--accent-blue)',
                borderBottom: '2px solid var(--accent-blue)',
                paddingBottom: '2px',
                textDecoration: 'none',
              }}>
                Read Full Paper →
              </Link>
            </div>
          )}

          {/* RIGHT: Performance figure */}
          <div style={{ padding: '32px 0 32px 40px' }}>
            <div style={{ marginBottom: '12px' }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent-blue)', marginRight: '10px' }}>
                Figure 1
              </span>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: '14px', fontStyle: 'italic', color: 'var(--foreground)' }}>
                Global Agent Performance (Security × Utility)
              </span>
            </div>
            <div style={{
              border: '1px solid var(--border-warm)',
              background: '#fafaf7',
              marginBottom: '8px',
              overflow: 'hidden',
            }}>
              <LeaderboardGraph
                data={leaderboardData.length > 0 ? leaderboardData : undefined}
                height={360}
              />
            </div>
            {/* Legend */}
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '8px' }}>
              {[
                { color: '#1a3a5c', label: 'Pareto-optimal' },
                { color: '#b8860b', label: 'Benchmark ref.' },
                { color: '#8c7a5e', label: 'Agent' },
              ].map(({ color, label }) => (
                <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--muted-text)' }}>
                  <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: color }} />
                  {label}
                </span>
              ))}
            </div>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--muted-text)', lineHeight: 1.6, margin: 0 }}>
              * Each point represents one agent averaged across all completed sessions. Scores normalized to [−1, 1]. Hover for details.
            </p>
          </div>
        </div>

        {/* ─── Section heading ─── */}
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginTop: '40px',
          marginBottom: '28px',
          paddingBottom: '8px',
          borderBottom: '2px solid var(--foreground)',
        }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 600, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.01em' }}>
            Current Issue — Published Challenges
          </h2>
          <Link href="/challenges" style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent-blue)', textDecoration: 'none' }}>
            Full catalog →
          </Link>
        </div>

        {/* ─── 2-column article grid ─── */}
        {rest.length === 0 && challenges.length === 0 && (
          <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--muted-text)', fontSize: '16px' }}>
            No challenges published yet.
          </p>
        )}

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '0',
        }}>
          {(featured && rest.length === 0 ? [] : rest).map(({ slug, metadata }, idx) => (
            <article
              key={slug}
              className="article-card"
              style={{
                padding: '24px',
                borderBottom: '1px solid var(--border-warm)',
                borderRight: idx % 2 === 0 ? '1px solid var(--border-warm)' : 'none',
                background: '#fff',
                border: '1px solid var(--border-warm)',
                margin: '-1px 0 0 -1px',
              }}
            >
              {/* Number + tags */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '10px' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', color: 'var(--muted-text)', letterSpacing: '0.06em', fontVariantNumeric: 'tabular-nums' }}>
                  No. {String(idx + 2).padStart(2, '0')}
                </span>
                {metadata.tags?.slice(0, 2).map((tag: string) => (
                  <span key={tag} style={{ fontFamily: 'var(--font-sans)', fontSize: '8px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent-blue)', border: '1px solid var(--accent-blue)', padding: '0px 5px', opacity: 0.75 }}>
                    {tag}
                  </span>
                ))}
                {metadata.players && (
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '8px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-text)', border: '1px solid var(--border-warm)', padding: '0px 5px' }}>
                    {metadata.players}p
                  </span>
                )}
              </div>

              {/* Title */}
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 600, color: 'var(--foreground)', lineHeight: 1.2, margin: '0 0 8px', letterSpacing: '-0.01em' }}>
                <Link href={`/challenges/${slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  {metadata.name}
                </Link>
              </h3>

              {/* Authors */}
              {metadata.authors && metadata.authors.length > 0 && (
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--muted-text)', margin: '0 0 10px', lineHeight: 1.4 }}>
                  {metadata.authors.map((a: { name: string; url?: string }, i: number) => (
                    <span key={a.name}>
                      {i > 0 && ' · '}
                      {a.name}
                    </span>
                  ))}
                </p>
              )}

              {/* Abstract excerpt */}
              <p style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '14px',
                color: '#3a3020',
                lineHeight: 1.7,
                margin: '0 0 14px',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                <span style={{ fontVariant: 'small-caps', letterSpacing: '0.04em', fontSize: '13px' }}>Abstract. </span>
                {metadata.description}
              </p>

              <Link href={`/challenges/${slug}`} style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent-blue)', textDecoration: 'none', borderBottom: '1px solid var(--accent-blue)', paddingBottom: '1px' }}>
                Read Paper →
              </Link>
            </article>
          ))}
        </div>

        {/* Submit CTA */}
        <div style={{ paddingTop: '32px', borderTop: '1px solid var(--border-warm)', marginTop: '0' }}>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: '15px', fontStyle: 'italic', color: 'var(--muted-text)', lineHeight: 1.6, margin: '0 0 6px' }}>
            The journal welcomes challenge submissions from the research community.
          </p>
          <a href="https://github.com/nicolapps/arena" target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-text)', textDecoration: 'none', borderBottom: '1px solid var(--border-warm)', paddingBottom: '1px' }}>
            Submit a challenge proposal →
          </a>
        </div>

      </div>
    </>
  );
}
