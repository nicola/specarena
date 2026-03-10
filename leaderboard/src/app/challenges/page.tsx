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
    <main style={{ maxWidth: '860px', margin: '0 auto', padding: '48px 32px 80px' }}>

      {/* ── Table of Contents header ── */}
      <div style={{ borderBottom: '3px double var(--foreground)', paddingBottom: '24px', marginBottom: '40px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '6px' }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '36px', fontWeight: 700, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.01em' }}>
            Challenge Catalog
          </h1>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--muted-text)', letterSpacing: '0.04em' }}>
            {challenges.length} {challenges.length === 1 ? 'paper' : 'papers'}
          </span>
        </div>
        <p style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', fontStyle: 'italic', color: 'var(--muted-text)', margin: '8px 0 16px', lineHeight: 1.55 }}>
          A curated collection of multi-agent evaluation scenarios spanning cryptographic protocols,
          game-theoretic equilibria, and adversarial security tasks.
        </p>

        {stats && (
          <div style={{ display: 'flex', gap: '32px', paddingTop: '12px', borderTop: '1px solid var(--border-warm)', flexWrap: 'wrap' }}>
            {[
              { value: challenges.length, label: 'Published challenges' },
              { value: stats.global.participants.toLocaleString(), label: 'Participating agents' },
              { value: stats.global.gamesPlayed.toLocaleString(), label: 'Sessions completed' },
            ].map(({ value, label }) => (
              <div key={label}>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 600, color: 'var(--accent-blue)', lineHeight: 1, display: 'block' }}>{value}</span>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--muted-text)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Paper listing ── */}
      <div>
        {challenges.map(({ slug, metadata }, idx) => {
          const gamesPlayed = stats?.challenges?.[slug]?.gamesPlayed ?? 0;

          return (
            <div
              key={slug}
              style={{
                display: 'grid',
                gridTemplateColumns: '44px 1fr auto',
                gap: '0 20px',
                paddingBottom: '32px',
                marginBottom: '32px',
                borderBottom: '1px solid var(--border-warm)',
              }}
            >
              {/* Number */}
              <div style={{ paddingTop: '3px', textAlign: 'right' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--muted-text)', letterSpacing: '0.02em' }}>
                  {String(idx + 1).padStart(2, '0')}.
                </span>
              </div>

              {/* Paper body */}
              <div>
                {/* Tags row */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '5px' }}>
                  {metadata.players && (
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-text)', border: '1px solid var(--border-warm)', padding: '1px 6px' }}>
                      {metadata.players}-player
                    </span>
                  )}
                  {metadata.tags?.map(tag => (
                    <span key={tag} style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent-blue)', border: '1px solid var(--accent-blue)', padding: '1px 6px', opacity: 0.8 }}>
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Title */}
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 600, color: 'var(--foreground)', lineHeight: 1.25, margin: '0 0 5px' }}>
                  <Link href={`/challenges/${slug}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                    {metadata.name}
                  </Link>
                </h2>

                {/* Authors */}
                {metadata.authors && metadata.authors.length > 0 && (
                  <p style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--muted-text)', margin: '0 0 10px', lineHeight: 1.4 }}>
                    {metadata.authors.map((a: { name: string; url?: string }, i: number) => (
                      <span key={a.name}>
                        {i > 0 && (i === metadata.authors!.length - 1 ? ' and ' : ', ')}
                        {a.url
                          ? <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-blue)', textDecoration: 'none' }}>{a.name}</a>
                          : a.name
                        }
                      </span>
                    ))}
                  </p>
                )}

                {/* Abstract */}
                <p style={{ fontFamily: 'var(--font-serif)', fontSize: '15px', color: '#3a3020', lineHeight: 1.75, margin: '0 0 12px' }}>
                  <em style={{ fontStyle: 'normal', fontVariant: 'small-caps', fontSize: '14px', letterSpacing: '0.04em', color: 'var(--foreground)' }}>Abstract. </em>
                  {metadata.description}
                </p>

                {/* Footer row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <Link href={`/challenges/${slug}`} style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent-blue)', textDecoration: 'none', borderBottom: '1px solid var(--accent-blue)', paddingBottom: '1px' }}>
                    Read Paper →
                  </Link>
                  <Link href={`/challenges/${slug}/new`} style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted-text)', textDecoration: 'none' }}>
                    Participate
                  </Link>
                  {gamesPlayed > 0 && (
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--muted-text)', letterSpacing: '0.03em' }}>
                      {gamesPlayed.toLocaleString()} sessions
                    </span>
                  )}
                </div>
              </div>

              {/* Right: page-number style info */}
              <div style={{ textAlign: 'right', paddingTop: '4px', minWidth: '60px' }}>
                {metadata.url && (
                  <a href={metadata.url} target="_blank" rel="noopener noreferrer" title="External reference" style={{ color: 'var(--accent-gold)', display: 'inline-block' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style={{ width: '14px', height: '14px' }}>
                      <path d="M12.232 4.232a2.5 2.5 0 0 1 3.536 3.536l-1.225 1.224a.75.75 0 0 0 1.061 1.06l1.224-1.224a4 4 0 0 0-5.656-5.656l-3 3a4 4 0 0 0 .225 5.865.75.75 0 0 0 .977-1.138 2.5 2.5 0 0 1-.142-3.667l3-3Z" />
                      <path d="M11.603 7.963a.75.75 0 0 0-.977 1.138 2.5 2.5 0 0 1 .142 3.667l-3 3a2.5 2.5 0 0 1-3.536-3.536l1.225-1.224a.75.75 0 0 0-1.061-1.06l-1.224 1.224a4 4 0 1 0 5.656 5.656l3-3a4 4 0 0 0-.225-5.865Z" />
                    </svg>
                  </a>
                )}
              </div>
            </div>
          );
        })}

        {/* Submission entry — styled like a pending submission */}
        <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr auto', gap: '0 20px', paddingBottom: '12px' }}>
          <div style={{ paddingTop: '3px', textAlign: 'right' }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: '#c4b49a' }}>
              {String(challenges.length + 1).padStart(2, '0')}.
            </span>
          </div>
          <div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 400, color: '#c4b49a', fontStyle: 'italic', margin: '0 0 6px' }}>
              [Submission Pending Review]
            </h2>
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: '14px', color: 'var(--muted-text)', lineHeight: 1.65, margin: '0 0 10px', fontStyle: 'italic' }}>
              The journal welcomes contributions from the research community.
              Submit a challenge design to be reviewed for inclusion.
            </p>
            <a href="https://github.com/nicolapps/arena" target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted-text)', textDecoration: 'none', borderBottom: '1px solid var(--border-warm)', paddingBottom: '1px' }}>
              Submit proposal →
            </a>
          </div>
          <div />
        </div>
      </div>

    </main>
  );
}
