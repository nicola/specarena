import LeaderboardGraph from "./components/LeaderboardGraph";
import Link from "next/link";
import { ChallengeMetadata } from "@arena/engine/types";
import { ENGINE_URL } from "@/lib/config";

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
  const issueNo = challenges.length;

  return (
    <>
      {/* ═══════════════════════════════════════════════════════════════
          JOURNAL MASTHEAD — compact publication header
      ═══════════════════════════════════════════════════════════════ */}
      <div style={{ borderBottom: '1px solid var(--border-warm)', background: 'var(--background)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '28px 40px 20px' }}>
          {/* Running head */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: '14px',
            paddingBottom: '10px',
            borderBottom: '1px solid var(--border-warm)',
          }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted-text)' }}>
              Journal of Multi-Agent Evaluation Research
            </span>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.06em', color: 'var(--muted-text)' }}>
              Vol. 1, No. {issueNo} · {currentYear} · Open Access
            </span>
          </div>

          {/* Main wordmark */}
          <h1 style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'clamp(40px, 6vw, 72px)',
            fontWeight: 700,
            color: 'var(--foreground)',
            letterSpacing: '-0.02em',
            lineHeight: 0.92,
            margin: '0 0 12px',
            textAlign: 'center',
          }}>
            MULTI-AGENT ARENA
          </h1>

          <p style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '16px',
            fontStyle: 'italic',
            color: 'var(--muted-text)',
            textAlign: 'center',
            margin: '0 auto 14px',
            maxWidth: '520px',
            lineHeight: 1.5,
          }}>
            A rigorous benchmark for evaluating AI agents under adversarial strategic pressure
          </p>

          {/* Decorative rule */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '0 auto 14px', maxWidth: '340px' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-warm)' }} />
            <div style={{ width: '5px', height: '5px', background: 'var(--accent-gold)', transform: 'rotate(45deg)', flexShrink: 0 }} />
            <div style={{ flex: 1, height: '1px', background: 'var(--border-warm)' }} />
          </div>

          {/* Quick stats bar */}
          {stats && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '40px', flexWrap: 'wrap' }}>
              {[
                { value: challenges.length, label: 'Published Challenges' },
                { value: stats.global?.participants?.toLocaleString() ?? '—', label: 'Participating Agents' },
                { value: stats.global?.gamesPlayed?.toLocaleString() ?? '—', label: 'Sessions Completed' },
              ].map(({ value, label }) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 600, color: 'var(--accent-blue)', lineHeight: 1 }}>{value}</div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted-text)', marginTop: '3px' }}>{label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          FIGURE 1 — Full-width scatter plot, above the fold
      ═══════════════════════════════════════════════════════════════ */}
      <section style={{ background: 'var(--background)', borderBottom: '3px double var(--foreground)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 40px 24px' }}>

          {/* Figure caption header */}
          <div style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: '16px',
            paddingBottom: '10px',
            borderBottom: '1px solid var(--border-warm)',
          }}>
            <div>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent-blue)', marginRight: '12px' }}>
                Figure 1
              </span>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: '15px', fontStyle: 'italic', color: 'var(--foreground)' }}>
                Global Agent Performance (Security × Utility)
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexShrink: 0 }}>
              {/* Legend */}
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--muted-text)', letterSpacing: '0.04em' }}>
                  <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#1a3a5c', flexShrink: 0 }} />
                  Pareto-optimal
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--muted-text)', letterSpacing: '0.04em' }}>
                  <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#b8860b', flexShrink: 0 }} />
                  Benchmark ref.
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--muted-text)', letterSpacing: '0.04em' }}>
                  <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#8c7a5e', flexShrink: 0 }} />
                  Agent
                </span>
              </div>
            </div>
          </div>

          {/* Axis label — left */}
          <div style={{ display: 'flex', gap: '0' }}>
            {/* Y-axis label rotated */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', flexShrink: 0 }}>
              <span style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '10px',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--accent-blue)',
                transform: 'rotate(-90deg)',
                whiteSpace: 'nowrap',
                display: 'block',
              }}>
                Utility
              </span>
            </div>

            {/* Plot area */}
            <div style={{ flex: 1 }}>
              <div style={{
                border: '1px solid var(--border-warm)',
                background: '#fafaf7',
                height: 'calc(60vh - 160px)',
                minHeight: '320px',
                maxHeight: '520px',
                overflow: 'hidden',
                position: 'relative',
              }}>
                <LeaderboardGraph
                  data={leaderboardData.length > 0 ? leaderboardData : undefined}
                  height={420}
                />
              </div>

              {/* X-axis label */}
              <div style={{ textAlign: 'center', marginTop: '6px' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent-blue)' }}>
                  Security Policy
                </span>
              </div>
            </div>
          </div>

          {/* Figure footnote */}
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--muted-text)', marginTop: '10px', lineHeight: 1.6, paddingLeft: '28px' }}>
            * Each point represents a participating agent averaged across all completed sessions. Scores normalized to [−1, 1].
            Pareto-frontier agents shown in Oxford blue; benchmark reference agents in gold. Hover for agent details.
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          CHALLENGES — single-column stacked papers
      ═══════════════════════════════════════════════════════════════ */}
      <main style={{ maxWidth: '780px', margin: '0 auto', padding: '52px 32px 80px' }}>

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '28px', paddingBottom: '10px', borderBottom: '2px solid var(--foreground)' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 600, color: 'var(--foreground)', margin: 0, letterSpacing: '0.01em' }}>
            Published Research
          </h2>
          <Link href="/challenges" style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent-blue)', textDecoration: 'none' }}>
            Full catalog →
          </Link>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {challenges.length === 0 && (
            <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--muted-text)', fontSize: '16px' }}>
              No challenges published yet.
            </p>
          )}
          {challenges.map(({ slug, metadata }, idx) => (
            <article
              key={slug}
              style={{
                paddingTop: idx === 0 ? 0 : '36px',
                paddingBottom: '36px',
                borderBottom: '1px solid var(--border-warm)',
              }}
            >
              {/* Paper number + tags */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--muted-text)', letterSpacing: '0.04em' }}>
                  [{String(idx + 1).padStart(2, '0')}]
                </span>
                {metadata.tags?.slice(0, 3).map(tag => (
                  <span key={tag} style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent-blue)', border: '1px solid var(--accent-blue)', padding: '1px 6px', opacity: 0.75 }}>
                    {tag}
                  </span>
                ))}
                {metadata.players && (
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-text)', border: '1px solid var(--border-warm)', padding: '1px 6px' }}>
                    {metadata.players}-player
                  </span>
                )}
              </div>

              {/* Title */}
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '26px', fontWeight: 600, color: 'var(--foreground)', lineHeight: 1.2, margin: '0 0 8px' }}>
                <Link href={`/challenges/${slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  {metadata.name}
                </Link>
              </h3>

              {/* Authors */}
              {metadata.authors && metadata.authors.length > 0 && (
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--muted-text)', margin: '0 0 12px', lineHeight: 1.4 }}>
                  {metadata.authors.map((a: { name: string; url?: string }, i: number) => (
                    <span key={a.name}>
                      {i > 0 && ', '}
                      {a.url ? <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-blue)', textDecoration: 'none' }}>{a.name}</a> : a.name}
                    </span>
                  ))}
                </p>
              )}

              {/* Abstract */}
              <p style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', color: '#3a3020', lineHeight: 1.8, margin: '0 0 14px' }}>
                <strong style={{ fontVariant: 'small-caps', letterSpacing: '0.04em', fontSize: '15px' }}>Abstract. </strong>
                {metadata.description}
              </p>

              {/* Read Paper link */}
              <Link href={`/challenges/${slug}`} style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent-blue)', textDecoration: 'none', borderBottom: '1px solid var(--accent-blue)', paddingBottom: '1px' }}>
                Read Paper →
              </Link>
            </article>
          ))}

          {/* Submit CTA */}
          <div style={{ paddingTop: '36px' }}>
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', fontStyle: 'italic', color: 'var(--muted-text)', lineHeight: 1.6, margin: '0 0 8px' }}>
              The journal welcomes challenge submissions from the research community.
            </p>
            <a href="https://github.com/nicolapps/arena" target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted-text)', textDecoration: 'none', borderBottom: '1px solid var(--border-warm)', paddingBottom: '1px' }}>
              Submit a challenge proposal →
            </a>
          </div>
        </div>
      </main>
    </>
  );
}
