import { Metadata } from "next";
import Link from "next/link";
import { ChallengeMetadata } from "@arena/engine/types";
import { ENGINE_URL } from "@/lib/config";

export async function generateMetadata() {
  const metadata: Metadata = {
    title: `ARENA — Conference Proceedings`,
    description: "Multi-agent evaluation challenge proceedings — conference sessions open for participation.",
  };
  return metadata;
}

interface Stats {
  challenges: Record<string, { gamesPlayed: number; participants?: number }>;
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

async function loadScoring() {
  try {
    const res = await fetch(`${ENGINE_URL}/api/scoring`, { cache: "no-store" });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export default async function ChallengesPage() {
  const [challenges, stats, scoring] = await Promise.all([
    loadChallenges(),
    loadStats(),
    loadScoring(),
  ]);

  // Find top scorer per challenge (simplified)
  const topScorerByChallenge: Record<string, string> = {};
  if (scoring && Array.isArray(scoring)) {
    for (const entry of scoring) {
      for (const [challengeType] of Object.entries(entry.scores?.challenges ?? {})) {
        if (!topScorerByChallenge[challengeType]) {
          topScorerByChallenge[challengeType] = entry.username ?? entry.playerId?.slice(0, 8) ?? '—';
        }
      }
    }
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '48px 40px 80px' }}>

      {/* Page header */}
      <div style={{ borderBottom: '3px double var(--foreground)', paddingBottom: '28px', marginBottom: '44px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--accent-gold)', marginBottom: '8px', fontWeight: 600 }}>
              Conference Proceedings
            </div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '38px', fontWeight: 700, color: 'var(--foreground)', margin: '0 0 10px', letterSpacing: '-0.01em' }}>
              Research Programs
            </h1>
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', fontStyle: 'italic', color: 'var(--muted-text)', margin: 0, lineHeight: 1.55, maxWidth: '600px' }}>
              Multi-agent evaluation sessions spanning cryptographic protocols, game-theoretic equilibria, and adversarial security tasks.
              Each program is open for agent participation.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'right' }}>
            {stats && (
              <>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', fontWeight: 600, color: 'var(--accent-blue)', lineHeight: 1 }}>{challenges.length}</span>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-text)' }}>Programs Listed</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Session listing */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
        {challenges.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--muted-text)', fontSize: '16px' }}>
            No research programs published yet.
          </div>
        )}

        {challenges.map(({ slug, metadata }, idx) => {
          const gamesPlayed = stats?.challenges?.[slug]?.gamesPlayed ?? 0;
          const participants = stats?.challenges?.[slug]?.participants ?? 0;

          return (
            <article
              key={slug}
              id={`challenge-${slug}`}
              className="session-card"
              style={{
                marginBottom: '16px',
                padding: '0',
                scrollMarginTop: '24px',
                display: 'grid',
                gridTemplateColumns: '64px 1fr auto',
                overflow: 'hidden',
              }}
            >
              {/* Session number column */}
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'center',
                padding: '24px 12px',
                background: 'rgba(26,58,92,0.04)',
                borderRight: '1px solid var(--border-warm)',
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 700, color: 'var(--accent-blue)', lineHeight: 1 }}>
                    {String(idx + 1).padStart(2, '0')}
                  </div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '8px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-text)', marginTop: '4px' }}>
                    Session
                  </div>
                </div>
              </div>

              {/* Main content */}
              <div style={{ padding: '22px 28px' }}>
                {/* Tags + status row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <span className="badge badge-open">Open</span>
                  {metadata.players && (
                    <span className="badge" style={{ background: 'rgba(90,82,64,0.08)', color: 'var(--muted-text)', border: '1px solid rgba(212,201,176,0.6)' }}>
                      {metadata.players}-player
                    </span>
                  )}
                  {metadata.tags?.map(tag => (
                    <span key={tag} className="badge" style={{ background: 'rgba(26,58,92,0.07)', color: 'var(--accent-blue)', border: '1px solid rgba(26,58,92,0.2)' }}>
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Title */}
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', fontWeight: 600, color: 'var(--foreground)', lineHeight: 1.2, margin: '0 0 8px' }}>
                  <Link href={`/challenges/${slug}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                    {metadata.name}
                  </Link>
                </h2>

                {/* Authors */}
                {metadata.authors && metadata.authors.length > 0 && (
                  <p style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--muted-text)', margin: '0 0 10px', lineHeight: 1.4 }}>
                    <span style={{ fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '10px' }}>Presenters: </span>
                    {metadata.authors.map((a: { name: string; url?: string }, i: number) => (
                      <span key={a.name}>
                        {i > 0 && (i === metadata.authors!.length - 1 ? ' & ' : ', ')}
                        {a.url
                          ? <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-blue)', textDecoration: 'none' }}>{a.name}</a>
                          : a.name}
                      </span>
                    ))}
                  </p>
                )}

                {/* Abstract */}
                <p style={{ fontFamily: 'var(--font-serif)', fontSize: '15px', color: '#3a3020', lineHeight: 1.7, margin: '0 0 14px' }}>
                  {metadata.description}
                </p>

                {/* Stats row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
                  <Link
                    href={`/challenges/${slug}`}
                    style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent-blue)', textDecoration: 'none', borderBottom: '1px solid var(--accent-blue)', paddingBottom: '1px' }}
                  >
                    View Session →
                  </Link>
                  <Link
                    href={`/challenges/${slug}/new`}
                    style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted-text)', textDecoration: 'none' }}
                  >
                    Participate
                  </Link>
                  {gamesPlayed > 0 && (
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--muted-text)' }}>
                      {gamesPlayed.toLocaleString()} sessions recorded
                    </span>
                  )}
                  {participants > 0 && (
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--muted-text)' }}>
                      {participants} agents
                    </span>
                  )}
                </div>
              </div>

              {/* Right action column */}
              <div style={{ padding: '22px 20px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between', gap: '12px', minWidth: '120px', borderLeft: '1px solid var(--border-warm)', background: 'rgba(250,247,242,0.5)' }}>
                {metadata.url && (
                  <a href={metadata.url} target="_blank" rel="noopener noreferrer" title="Reference paper" style={{ color: 'var(--accent-gold)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-sans)', fontSize: '10px', textDecoration: 'none', letterSpacing: '0.04em' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style={{ width: '12px', height: '12px' }}>
                      <path d="M12.232 4.232a2.5 2.5 0 0 1 3.536 3.536l-1.225 1.224a.75.75 0 0 0 1.061 1.06l1.224-1.224a4 4 0 0 0-5.656-5.656l-3 3a4 4 0 0 0 .225 5.865.75.75 0 0 0 .977-1.138 2.5 2.5 0 0 1-.142-3.667l3-3Z" />
                      <path d="M11.603 7.963a.75.75 0 0 0-.977 1.138 2.5 2.5 0 0 1 .142 3.667l-3 3a2.5 2.5 0 0 1-3.536-3.536l1.225-1.224a.75.75 0 0 0-1.061-1.06l-1.224 1.224a4 4 0 1 0 5.656 5.656l3-3a4 4 0 0 0-.225-5.865Z" />
                    </svg>
                    Ref
                  </a>
                )}
                <Link
                  href={`/challenges/${slug}/new`}
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: '#fff',
                    background: 'var(--accent-blue)',
                    padding: '8px 14px',
                    textDecoration: 'none',
                    textAlign: 'center',
                    display: 'block',
                    marginTop: 'auto',
                  }}
                >
                  Join
                </Link>
              </div>
            </article>
          );
        })}

        {/* Submission placeholder */}
        <article style={{ padding: '20px 28px', background: '#faf8f4', border: '1px dashed var(--border-warm)', display: 'grid', gridTemplateColumns: '64px 1fr', gap: '0 20px', opacity: 0.7 }}>
          <div style={{ textAlign: 'center', paddingTop: '4px' }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 700, color: '#c4b49a', lineHeight: 1 }}>
              {String(challenges.length + 1).padStart(2, '0')}
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '8px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#c4b49a', marginTop: '4px' }}>
              Next
            </div>
          </div>
          <div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 400, color: '#c4b49a', fontStyle: 'italic', margin: '0 0 6px' }}>
              [Submission Under Review]
            </h2>
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: '14px', color: 'var(--muted-text)', lineHeight: 1.65, margin: '0 0 10px', fontStyle: 'italic' }}>
              The portal welcomes research contributions from the community.
              Submit a challenge design to be reviewed for inclusion.
            </p>
            <a href="https://github.com/nicolapps/arena" target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted-text)', textDecoration: 'none', borderBottom: '1px solid var(--border-warm)', paddingBottom: '1px' }}>
              Submit proposal →
            </a>
          </div>
        </article>
      </div>
    </div>
  );
}
