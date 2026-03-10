import { Metadata } from "next";
import Link from "next/link";
import { ChallengeMetadata } from "@arena/engine/types";
import { ENGINE_URL } from "@/lib/config";

export async function generateMetadata() {
  const metadata: Metadata = {
    title: `ARENA — Challenge Catalog`,
    description: "A curated catalog of multi-agent evaluation challenges testing AI security, coordination, and strategic reasoning.",
  };
  return metadata;
}

interface Stats {
  challenges: Record<string, { gamesPlayed: number }>;
  global: { participants: number; gamesPlayed: number };
}

async function loadChallenges(): Promise<{ slug: string; metadata: ChallengeMetadata }[]> {
  try {
    const res = await fetch(`${ENGINE_URL}/api/metadata`, { cache: "no-store" });
    if (!res.ok) return [];
    const all: Record<string, ChallengeMetadata> = await res.json();
    return Object.entries(all).map(([slug, metadata]) => ({ slug, metadata }));
  } catch {
    return [];
  }
}

async function loadStats(): Promise<Stats | null> {
  try {
    const res = await fetch(`${ENGINE_URL}/api/stats`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function ChallengesPage() {
  const [challenges, stats] = await Promise.all([loadChallenges(), loadStats()]);

  return (
    <main style={{ maxWidth: '860px', margin: '0 auto', padding: '52px 40px 80px' }}>

      {/* ── Volume header with double rule — journal TOC style ── */}
      <div style={{ marginBottom: '0' }}>
        {/* Top double rule */}
        <div style={{ borderTop: '3px double var(--foreground)', paddingTop: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '4px' }}>
            <div>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted-text)', display: 'block', marginBottom: '6px' }}>
                Journal of Multi-Agent Evaluation Research
              </span>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '38px', fontWeight: 700, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.01em', lineHeight: 1.1 }}>
                Vol. 1 — Challenges Index
              </h1>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--muted-text)', letterSpacing: '0.04em', display: 'block' }}>
                {challenges.length} {challenges.length === 1 ? 'entry' : 'entries'}
              </span>
              {stats && (
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--muted-text)', letterSpacing: '0.03em', display: 'block', marginTop: '2px' }}>
                  {stats.global.gamesPlayed.toLocaleString()} sessions
                </span>
              )}
            </div>
          </div>

          <p style={{ fontFamily: 'var(--font-serif)', fontSize: '15px', fontStyle: 'italic', color: 'var(--muted-text)', margin: '10px 0 0', lineHeight: 1.55 }}>
            A curated collection of multi-agent evaluation scenarios spanning cryptographic protocols,
            game-theoretic equilibria, and adversarial security tasks.
          </p>

          {/* Bottom double rule */}
          <div style={{ borderBottom: '3px double var(--foreground)', marginTop: '20px' }} />
        </div>
      </div>

      {/* ── Table of Contents entries ── */}
      <div style={{ marginTop: '0' }}>
        {challenges.length === 0 && (
          <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--muted-text)', fontSize: '16px', paddingTop: '32px' }}>
            No challenges published yet.
          </p>
        )}

        {challenges.map(({ slug, metadata }, idx) => {
          const gamesPlayed = stats?.challenges?.[slug]?.gamesPlayed ?? 0;
          const pageNum = idx + 1;

          return (
            <Link
              key={slug}
              href={`/challenges/${slug}`}
              style={{ textDecoration: 'none', display: 'block' }}
            >
              <div
                className="toc-entry"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '60px 1fr auto',
                  gap: '0 24px',
                  alignItems: 'baseline',
                  padding: '16px 0',
                  borderBottom: '1px solid var(--border-warm)',
                  cursor: 'pointer',
                }}
              >
                {/* Entry number */}
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--muted-text)', letterSpacing: '0.04em', fontVariantNumeric: 'tabular-nums' }}>
                    No. {String(idx + 1).padStart(2, '0')}
                  </span>
                </div>

                {/* Entry body — title + tags + dotted leader */}
                <div>
                  {/* Title line with dotted leader */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <span style={{
                      fontFamily: 'var(--font-serif)',
                      fontSize: '20px',
                      fontWeight: 600,
                      color: 'var(--foreground)',
                      lineHeight: 1.3,
                      flexShrink: 0,
                    }}>
                      {metadata.name}
                    </span>
                    {/* Dotted leader line */}
                    <span style={{
                      flex: 1,
                      borderBottom: '1px dotted var(--border-warm)',
                      marginBottom: '4px',
                      minWidth: '20px',
                    }} />
                  </div>

                  {/* Tags row */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '5px' }}>
                    {metadata.players && (
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-text)', border: '1px solid var(--border-warm)', padding: '1px 5px' }}>
                        {metadata.players}-player
                      </span>
                    )}
                    {metadata.tags?.map(tag => (
                      <span key={tag} style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent-blue)', border: '1px solid var(--accent-blue)', padding: '1px 5px', opacity: 0.75 }}>
                        {tag}
                      </span>
                    ))}
                    {gamesPlayed > 0 && (
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', color: 'var(--muted-text)', letterSpacing: '0.03em', padding: '1px 0' }}>
                        {gamesPlayed.toLocaleString()} sessions
                      </span>
                    )}
                  </div>
                </div>

                {/* Right-aligned page marker */}
                <div style={{ textAlign: 'right', flexShrink: 0, minWidth: '32px' }}>
                  <span style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: '16px',
                    color: 'var(--accent-blue)',
                    fontVariantNumeric: 'oldstyle-nums',
                    letterSpacing: '-0.01em',
                  }}>
                    p.{pageNum}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}

        {/* Submission pending — ghost entry */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '60px 1fr auto',
          gap: '0 24px',
          alignItems: 'baseline',
          padding: '16px 0 0',
          opacity: 0.5,
        }}>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--muted-text)', letterSpacing: '0.04em' }}>
              No. {String(challenges.length + 1).padStart(2, '0')}
            </span>
          </div>
          <div>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 400, color: 'var(--muted-text)', fontStyle: 'italic' }}>
              [Submission Pending Review]
            </span>
            <div style={{ marginTop: '6px' }}>
              <a
                href="https://github.com/nicolapps/arena"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted-text)', textDecoration: 'none', borderBottom: '1px solid var(--border-warm)', paddingBottom: '1px' }}>
                Submit proposal →
              </a>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', color: 'var(--muted-text)' }}>
              p.—
            </span>
          </div>
        </div>
      </div>

      {/* ── Footer note ── */}
      <div style={{ marginTop: '52px', paddingTop: '16px', borderTop: '1px solid var(--border-warm)' }}>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--muted-text)', lineHeight: 1.7, letterSpacing: '0.03em' }}>
          All challenges are peer-reviewed and available under open-access terms.
          Session statistics update in real time. Click any entry to access the full paper and participate.
        </p>
      </div>

    </main>
  );
}
