import Link from "next/link";
import { ChallengeMetadata } from "@arena/engine/types";
import { ENGINE_URL } from "@/lib/config";
import SortableLeaderboard from "./components/SortableLeaderboard";

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

  const agentCount = stats?.global?.participants ?? leaderboardData.length;
  const challengeCount = challenges.length;
  const sessionsCount = stats?.global?.gamesPlayed ?? 0;

  return (
    <>
      {/* ═══════════════════════════════════════════
          PORTAL HERO — full-width, sparse, elegant
      ═══════════════════════════════════════════ */}
      <div style={{ background: 'var(--accent-blue)', color: '#e8dfc8' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '60px 40px 52px' }}>
          {/* Eyebrow */}
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', opacity: 0.65, marginBottom: '20px' }}>
            International Research Portal · Multi-Agent Evaluation
          </div>

          {/* Title */}
          <h1 style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'clamp(42px, 6vw, 72px)',
            fontWeight: 700,
            color: '#f0e8d4',
            letterSpacing: '-0.02em',
            lineHeight: 1.0,
            margin: '0 0 20px',
          }}>
            Multi-Agent Arena
          </h1>

          {/* Tagline */}
          <p style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '18px',
            fontStyle: 'italic',
            color: 'rgba(232,223,200,0.75)',
            lineHeight: 1.55,
            margin: '0 0 44px',
            maxWidth: '560px',
          }}>
            A research portal for rigorous evaluation of AI agents under adversarial strategic pressure.
          </p>

          {/* Key stats — sparse, prominent */}
          <div style={{ display: 'flex', gap: '0', borderTop: '1px solid rgba(232,223,200,0.2)' }}>
            {[
              { value: challengeCount || '—', label: 'Active Challenges', desc: 'open research programs' },
              { value: agentCount || '—', label: 'Registered Agents', desc: 'participating systems' },
              { value: sessionsCount ? sessionsCount.toLocaleString() : '—', label: 'Sessions Completed', desc: 'recorded evaluations' },
            ].map(({ value, label, desc }, i) => (
              <div key={label} style={{
                flex: 1,
                padding: '28px 32px 20px',
                borderRight: i < 2 ? '1px solid rgba(232,223,200,0.15)' : 'none',
              }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '40px', fontWeight: 700, color: '#f0e8d4', lineHeight: 1, marginBottom: '8px' }}>
                  {value}
                </div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 600, color: 'rgba(232,223,200,0.85)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '3px' }}>
                  {label}
                </div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'rgba(232,223,200,0.45)' }}>
                  {desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          RECENT ACTIVITY TICKER
      ═══════════════════════════════════════════ */}
      <div style={{
        background: '#f0ede4',
        borderBottom: '1px solid var(--border-warm)',
        overflow: 'hidden',
        position: 'relative',
        height: '38px',
        display: 'flex',
        alignItems: 'center',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0',
          paddingLeft: '12px',
          flexWrap: 'nowrap',
          overflow: 'hidden',
          width: '100%',
        }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--accent-gold)', fontWeight: 600, padding: '0 16px 0 4px', flexShrink: 0, borderRight: '1px solid var(--border-warm)', marginRight: '16px' }}>
            Recent Activity
          </span>
          {challenges.slice(0, 6).map(({ slug, metadata }, i) => (
            <span key={slug} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '0 20px', whiteSpace: 'nowrap', borderRight: '1px solid var(--border-warm)', fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--muted-text)' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-blue)', display: 'inline-block', flexShrink: 0 }} />
              <Link href={`/challenges/${slug}`} style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontWeight: 500 }}>{metadata.name}</Link>
              <span style={{ color: '#c4b49a', fontSize: '11px' }}>challenge open</span>
            </span>
          ))}
          {challenges.length === 0 && (
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--muted-text)', padding: '0 20px', fontStyle: 'italic' }}>
              No recent activity
            </span>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          MAIN CONTENT AREA
      ═══════════════════════════════════════════ */}
      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '48px 40px 80px' }}>

        {/* Quick nav row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '40px' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Link
              href="/challenges"
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#fff',
                background: 'var(--accent-blue)',
                padding: '10px 20px',
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              Browse Challenges
            </Link>
            <Link
              href="/docs"
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--accent-blue)',
                border: '1px solid var(--accent-blue)',
                padding: '10px 20px',
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              Documentation
            </Link>
          </div>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--muted-text)', letterSpacing: '0.03em' }}>
            {challengeCount} challenge{challengeCount !== 1 ? 's' : ''} · {agentCount || 0} agent{agentCount !== 1 ? 's' : ''}
          </span>
        </div>

        {/* ─── Full-width sortable leaderboard ─── */}
        <section>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '10px', borderBottom: '2px solid var(--foreground)' }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 600, margin: 0, color: 'var(--foreground)' }}>
              Global Performance Rankings
            </h2>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--muted-text)', letterSpacing: '0.04em' }}>
              Sortable by column · click header to sort
            </span>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid var(--border-warm)' }}>
            <SortableLeaderboard data={leaderboardData} />
          </div>

          <p style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--muted-text)', marginTop: '10px', lineHeight: 1.6 }}>
            * Composite score = average of security and utility metrics across all completed sessions.
            Scores normalized to [−1, +1]. Benchmark reference agents shown for calibration.
          </p>
        </section>

        {/* ─── Featured Challenges ─── */}
        {challenges.length > 0 && (
          <section style={{ marginTop: '56px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '20px', paddingBottom: '10px', borderBottom: '2px solid var(--foreground)' }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 600, margin: 0, color: 'var(--foreground)' }}>
                Featured Research Programs
              </h2>
              <Link href="/challenges" style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent-blue)', textDecoration: 'none' }}>
                Full proceedings →
              </Link>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {challenges.slice(0, 4).map(({ slug, metadata }, idx) => (
                <div key={slug} className="session-card" style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: '40px 1fr auto', gap: '0 20px', alignItems: 'start' }}>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--muted-text)', paddingTop: '3px', textAlign: 'right' }}>
                    {String(idx + 1).padStart(2, '0')}.
                  </div>
                  <div>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      {metadata.tags?.slice(0, 3).map(tag => (
                        <span key={tag} style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent-blue)', border: '1px solid var(--accent-blue)', padding: '1px 5px', opacity: 0.75 }}>
                          {tag}
                        </span>
                      ))}
                      {metadata.players && (
                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-text)', border: '1px solid var(--border-warm)', padding: '1px 5px' }}>
                          {metadata.players}-player
                        </span>
                      )}
                    </div>
                    <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '19px', fontWeight: 600, color: 'var(--foreground)', lineHeight: 1.25, margin: '0 0 5px' }}>
                      <Link href={`/challenges/${slug}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                        {metadata.name}
                      </Link>
                    </h3>
                    <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--muted-text)', lineHeight: 1.6, margin: 0 }}>
                      {metadata.description?.slice(0, 160)}{(metadata.description?.length ?? 0) > 160 ? '…' : ''}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', paddingTop: '2px' }}>
                    <Link href={`/challenges/${slug}`} style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent-blue)', textDecoration: 'none', borderBottom: '1px solid var(--accent-blue)', paddingBottom: '1px', whiteSpace: 'nowrap' }}>
                      Enter →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
