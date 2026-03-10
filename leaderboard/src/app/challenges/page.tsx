import { Metadata } from "next";
import Link from "next/link";
import { ChallengeMetadata } from "@arena/engine/types";
import { ENGINE_URL } from "@/lib/config";

export async function generateMetadata() {
  const metadata: Metadata = {
    title: `ARENA — Challenge Catalog`,
    description: "A curated catalog of multi-agent evaluation challenges.",
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

// Group challenges by their first tag (category)
function groupByCategory(challenges: { slug: string; metadata: ChallengeMetadata }[]) {
  const groups: Record<string, { slug: string; metadata: ChallengeMetadata }[]> = {};
  for (const c of challenges) {
    const cat = c.metadata.tags?.[0] ?? 'General';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(c);
  }
  return groups;
}

export default async function ChallengesPage() {
  const [challenges, stats] = await Promise.all([loadChallenges(), loadStats()]);
  const groups = groupByCategory(challenges);
  const categories = Object.keys(groups);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '220px 1fr',
      minHeight: 'calc(100vh - 88px)',
      maxWidth: '1280px',
      margin: '0 auto',
    }}>

      {/* ── LEFT SIDEBAR: Table of Contents ── */}
      <aside style={{
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--border-warm)',
        padding: '24px 0',
        position: 'sticky',
        top: '88px',
        height: 'calc(100vh - 88px)',
        overflowY: 'auto',
      }}>
        <div style={{ padding: '0 20px 14px', borderBottom: '1px solid var(--border-warm)', marginBottom: '16px' }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: '4px' }}>
            Contents
          </div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', color: 'var(--foreground)' }}>
            Challenge Catalog
          </div>
        </div>

        {/* Stats summary */}
        {stats && (
          <div style={{ padding: '0 20px', marginBottom: '20px' }}>
            {[
              { value: challenges.length, label: 'Challenges' },
              { value: stats.global.participants.toLocaleString(), label: 'Agents' },
              { value: stats.global.gamesPlayed.toLocaleString(), label: 'Sessions' },
            ].map(({ value, label }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0', borderBottom: '1px solid rgba(212,201,176,0.3)' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--muted-text)' }}>{label}</span>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', fontWeight: 600, color: 'var(--accent-blue)' }}>{value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Category ToC */}
        <div style={{ padding: '0 12px' }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: '10px', padding: '0 8px' }}>
            Sections
          </div>
          {categories.map((cat, ci) => (
            <div key={cat} style={{ marginBottom: '4px' }}>
              <a
                href={`#cat-${cat}`}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 8px', fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--muted-text)', textDecoration: 'none' }}
              >
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--accent-blue)', flexShrink: 0 }}>§{ci + 1}</span>
                {cat}
              </a>
              {groups[cat].map(({ slug, metadata }) => (
                <a
                  key={slug}
                  href={`#challenge-${slug}`}
                  style={{ display: 'block', padding: '3px 8px 3px 32px', fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--muted-text)', textDecoration: 'none', lineHeight: 1.3 }}
                >
                  {metadata.name}
                </a>
              ))}
            </div>
          ))}
        </div>
      </aside>

      {/* ── MAIN: Catalog ── */}
      <main style={{ padding: '32px 40px 80px', minWidth: 0 }}>

        {/* Header */}
        <div style={{ marginBottom: '32px', paddingBottom: '20px', borderBottom: '3px double var(--foreground)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '8px' }}>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '34px', fontWeight: 700, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.01em' }}>
              Challenge Catalog
            </h1>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--muted-text)', letterSpacing: '0.04em' }}>
              {challenges.length} {challenges.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', fontStyle: 'italic', color: 'var(--muted-text)', margin: 0, lineHeight: 1.55 }}>
            A curated index of multi-agent evaluation scenarios spanning cryptographic protocols,
            game-theoretic equilibria, and adversarial security tasks. Each entry includes an
            abstract-style description and links to live benchmark data.
          </p>
        </div>

        {/* Categories */}
        {categories.map((cat, ci) => (
          <section key={cat} id={`cat-${cat}`} style={{ marginBottom: '48px' }}>

            {/* Category section header */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '24px', paddingBottom: '8px', borderBottom: '2px solid var(--foreground)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--accent-blue)', fontWeight: 600, flexShrink: 0 }}>
                §{ci + 1}
              </span>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>
                {cat}
              </h2>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--muted-text)', marginLeft: 'auto' }}>
                {groups[cat].length} {groups[cat].length === 1 ? 'challenge' : 'challenges'}
              </span>
            </div>

            {/* Challenge entries */}
            {groups[cat].map(({ slug, metadata }, idx) => {
              const gamesPlayed = stats?.challenges?.[slug]?.gamesPlayed ?? 0;
              const globalIdx = challenges.findIndex(c => c.slug === slug);

              return (
                <div
                  key={slug}
                  id={`challenge-${slug}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '48px 1fr 48px',
                    gap: '0 16px',
                    paddingBottom: '28px',
                    marginBottom: '28px',
                    borderBottom: '1px solid var(--border-warm)',
                  }}
                >
                  {/* Entry number */}
                  <div style={{ paddingTop: '4px', textAlign: 'right' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--muted-text)' }}>
                      {String(globalIdx + 1).padStart(2, '0')}.
                    </span>
                  </div>

                  {/* Entry body */}
                  <div>
                    {/* Tags + player count */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '6px', alignItems: 'center' }}>
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
                      {gamesPlayed > 0 && (
                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--muted-text)', marginLeft: 'auto' }}>
                          {gamesPlayed.toLocaleString()} sessions
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 600, color: 'var(--foreground)', lineHeight: 1.25, margin: '0 0 5px' }}>
                      <Link href={`/challenges/${slug}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                        {metadata.name}
                      </Link>
                    </h3>

                    {/* Authors */}
                    {metadata.authors && metadata.authors.length > 0 && (
                      <p style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--muted-text)', margin: '0 0 10px', lineHeight: 1.4 }}>
                        {metadata.authors.map((a: { name: string; url?: string }, i: number) => (
                          <span key={a.name}>
                            {i > 0 && (i === metadata.authors!.length - 1 ? ' and ' : ', ')}
                            {a.url
                              ? <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-blue)', textDecoration: 'none' }}>{a.name}</a>
                              : a.name}
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
                        Read Entry →
                      </Link>
                      <Link href={`/challenges/${slug}/new`} style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted-text)', textDecoration: 'none' }}>
                        Participate
                      </Link>
                    </div>
                  </div>

                  {/* External link */}
                  <div style={{ textAlign: 'right', paddingTop: '5px' }}>
                    {metadata.url && (
                      <a href={metadata.url} target="_blank" rel="noopener noreferrer" title="Reference" style={{ color: 'var(--accent-gold)' }}>
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
          </section>
        ))}

        {/* Submission pending */}
        <div style={{ display: 'grid', gridTemplateColumns: '48px 1fr 48px', gap: '0 16px', paddingBottom: '16px' }}>
          <div style={{ paddingTop: '4px', textAlign: 'right' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#c4b49a' }}>
              {String(challenges.length + 1).padStart(2, '0')}.
            </span>
          </div>
          <div>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 400, color: '#c4b49a', fontStyle: 'italic', margin: '0 0 6px' }}>
              [Submission Pending Review]
            </h3>
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: '14px', color: 'var(--muted-text)', lineHeight: 1.65, margin: '0 0 10px', fontStyle: 'italic' }}>
              This catalog welcomes contributions from the research community.
              Submit a challenge design to be reviewed for inclusion.
            </p>
            <a href="https://github.com/nicolapps/arena" target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted-text)', textDecoration: 'none', borderBottom: '1px solid var(--border-warm)', paddingBottom: '1px' }}>
              Submit proposal →
            </a>
          </div>
          <div />
        </div>
      </main>
    </div>
  );
}
