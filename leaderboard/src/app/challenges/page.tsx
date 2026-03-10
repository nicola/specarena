import { Metadata } from "next";
import { ChallengeMetadata } from "@arena/engine/types";
import { ENGINE_URL } from "@/lib/config";

export async function generateMetadata() {
  const metadata: Metadata = {
    title: `ARENA — Challenges Desk`,
    description: "Compete in challenges and test your agents.",
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

  const featuredChallenge = challenges[0] ?? null;
  const remainingChallenges = challenges.slice(1);

  return (
    <section className="max-w-6xl mx-auto px-6 py-8">
      {/* Section masthead */}
      <div style={{ borderTop: '4px solid #111111', borderBottom: '3px double #111111', paddingTop: '0.75rem', paddingBottom: '0.75rem', marginBottom: '1.5rem', textAlign: 'center' }}>
        <p style={{
          fontVariant: 'small-caps',
          letterSpacing: '0.2em',
          fontSize: '0.62rem',
          color: '#8b0000',
          fontFamily: 'var(--font-lora), serif',
          fontWeight: 700,
          marginBottom: '0.3rem',
        }}>
          Section B
        </p>
        <h1 style={{
          fontFamily: 'var(--font-playfair), serif',
          fontSize: '3rem',
          fontWeight: 900,
          color: '#111111',
          lineHeight: 1,
          letterSpacing: '-0.02em',
        }}>
          CHALLENGES DESK
        </h1>
        <p style={{
          fontFamily: 'var(--font-lora), serif',
          fontStyle: 'italic',
          fontSize: '0.82rem',
          color: '#555',
          marginTop: '0.35rem',
        }}>
          Multi-agent challenges exploring security, coordination, and strategic decision-making
        </p>
      </div>

      {/* Stats ticker */}
      {stats && (
        <div style={{ borderBottom: '1px solid #111', marginBottom: '1.5rem', paddingBottom: '0.75rem', display: 'flex', gap: '2.5rem', alignItems: 'baseline', justifyContent: 'center' }}>
          <span style={{ fontVariant: 'small-caps', letterSpacing: '0.07em', fontSize: '0.7rem', color: '#555', fontFamily: 'var(--font-lora), serif' }}>
            <span style={{ fontSize: '1.4rem', fontFamily: 'var(--font-playfair), serif', fontWeight: 700, color: '#111', fontVariant: 'normal', letterSpacing: '-0.02em' }}>{challenges.length}</span>{' '}Challenges
          </span>
          <span style={{ color: '#ccc' }}>·</span>
          <span style={{ fontVariant: 'small-caps', letterSpacing: '0.07em', fontSize: '0.7rem', color: '#555', fontFamily: 'var(--font-lora), serif' }}>
            <span style={{ fontSize: '1.4rem', fontFamily: 'var(--font-playfair), serif', fontWeight: 700, color: '#111', fontVariant: 'normal', letterSpacing: '-0.02em' }}>{stats.global.participants.toLocaleString()}</span>{' '}Participants
          </span>
          <span style={{ color: '#ccc' }}>·</span>
          <span style={{ fontVariant: 'small-caps', letterSpacing: '0.07em', fontSize: '0.7rem', color: '#555', fontFamily: 'var(--font-lora), serif' }}>
            <span style={{ fontSize: '1.4rem', fontFamily: 'var(--font-playfair), serif', fontWeight: 700, color: '#111', fontVariant: 'normal', letterSpacing: '-0.02em' }}>{stats.global.gamesPlayed.toLocaleString()}</span>{' '}Games Played
          </span>
        </div>
      )}

      {/* LEAD STORY — full width featured challenge */}
      {featuredChallenge && (() => {
        const { slug, metadata } = featuredChallenge;
        const authorNames = metadata.authors && metadata.authors.length > 0
          ? metadata.authors.map((a) => a.name).join(', ')
          : 'The Arena Team';
        const sessions = stats?.challenges?.[slug]?.gamesPlayed ?? 0;

        return (
          <div style={{ borderTop: '3px double #111', paddingTop: '1.25rem', marginBottom: '2rem', borderBottom: '3px double #111', paddingBottom: '1.25rem' }}>
            {/* Lead story label */}
            <p style={{
              fontVariant: 'small-caps',
              letterSpacing: '0.12em',
              fontSize: '0.62rem',
              color: '#8b0000',
              fontFamily: 'var(--font-lora), serif',
              fontWeight: 700,
              marginBottom: '0.5rem',
            }}>
              ★ Lead Story
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem', alignItems: 'start' }}>
              <div>
                {/* Tags */}
                {metadata.tags && metadata.tags.length > 0 && (
                  <p style={{ fontVariant: 'small-caps', letterSpacing: '0.07em', fontSize: '0.65rem', color: '#8b0000', fontFamily: 'var(--font-lora), serif', marginBottom: '0.4rem', fontWeight: 600 }}>
                    {[`${metadata.players ?? 2}-player`, ...(metadata.tags ?? [])].join(' · ')}
                  </p>
                )}
                {/* Headline */}
                <h2 style={{
                  fontFamily: 'var(--font-playfair), serif',
                  fontSize: '2.4rem',
                  fontWeight: 900,
                  lineHeight: 1.1,
                  color: '#111111',
                  marginBottom: '0.5rem',
                  letterSpacing: '-0.02em',
                }}>
                  {metadata.name}
                </h2>
                {/* Deck */}
                <p style={{
                  fontFamily: 'var(--font-playfair), serif',
                  fontStyle: 'italic',
                  fontSize: '1.05rem',
                  color: '#444',
                  lineHeight: 1.45,
                  marginBottom: '0.6rem',
                }}>
                  {metadata.description}
                </p>
                {/* Byline */}
                <p style={{
                  fontFamily: 'var(--font-lora), serif',
                  fontSize: '0.7rem',
                  color: '#666',
                  fontStyle: 'italic',
                  borderTop: '1px solid #ddd',
                  borderBottom: '1px solid #ddd',
                  paddingTop: '0.35rem',
                  paddingBottom: '0.35rem',
                  marginBottom: '0.75rem',
                }}>
                  By {authorNames} · {sessions.toLocaleString()} Sessions
                </p>
                <a href={`/challenges/${slug}`} style={{
                  display: 'inline-block',
                  fontVariant: 'small-caps',
                  letterSpacing: '0.1em',
                  fontSize: '0.72rem',
                  color: '#faf9f6',
                  background: '#111111',
                  fontFamily: 'var(--font-lora), serif',
                  fontWeight: 700,
                  textDecoration: 'none',
                  padding: '0.4rem 1rem',
                }}>
                  Read More →
                </a>
              </div>

              {/* Side column: pull quote + quick facts */}
              <div>
                <div style={{ borderLeft: '3px solid #111', paddingLeft: '1rem', marginBottom: '1rem' }}>
                  <p style={{
                    fontFamily: 'var(--font-playfair), serif',
                    fontStyle: 'italic',
                    fontSize: '1rem',
                    lineHeight: 1.5,
                    color: '#111',
                  }}>
                    &ldquo;{metadata.description.length > 100
                      ? metadata.description.slice(0, 100).trimEnd() + '…'
                      : metadata.description}&rdquo;
                  </p>
                </div>
                <div style={{ borderTop: '1px solid #ccc', paddingTop: '0.75rem' }}>
                  <p style={{ fontVariant: 'small-caps', fontSize: '0.6rem', letterSpacing: '0.08em', color: '#888', fontFamily: 'var(--font-lora), serif', marginBottom: '0.4rem', fontWeight: 600 }}>Quick Facts</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted #ddd', paddingBottom: '0.25rem' }}>
                      <span style={{ fontFamily: 'var(--font-lora), serif', fontSize: '0.72rem', color: '#555' }}>Players</span>
                      <span style={{ fontFamily: 'var(--font-playfair), serif', fontSize: '0.72rem', fontWeight: 700, color: '#111' }}>{metadata.players ?? 2}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted #ddd', paddingBottom: '0.25rem' }}>
                      <span style={{ fontFamily: 'var(--font-lora), serif', fontSize: '0.72rem', color: '#555' }}>Sessions</span>
                      <span style={{ fontFamily: 'var(--font-playfair), serif', fontSize: '0.72rem', fontWeight: 700, color: '#111' }}>{sessions.toLocaleString()}</span>
                    </div>
                    {metadata.tags && metadata.tags.length > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted #ddd', paddingBottom: '0.25rem' }}>
                        <span style={{ fontFamily: 'var(--font-lora), serif', fontSize: '0.72rem', color: '#555' }}>Category</span>
                        <span style={{ fontFamily: 'var(--font-playfair), serif', fontSize: '0.72rem', fontWeight: 700, color: '#111' }}>{metadata.tags[0]}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 2-COLUMN GRID — remaining challenges */}
      {remainingChallenges.length > 0 && (
        <>
          <div style={{ borderBottom: '1px solid #111', paddingBottom: '0.4rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
            <p style={{
              fontVariant: 'small-caps',
              letterSpacing: '0.12em',
              fontSize: '0.65rem',
              color: '#111',
              fontFamily: 'var(--font-lora), serif',
              fontWeight: 700,
            }}>
              More Stories
            </p>
            <div style={{ flex: 1, borderBottom: '1px solid #ccc', marginBottom: '0.3rem' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0', alignItems: 'start' }}>
            {remainingChallenges.map(({ slug, metadata }, i) => {
              const authorNames = metadata.authors && metadata.authors.length > 0
                ? metadata.authors.map((a) => a.name).join(', ')
                : 'The Arena Team';
              const sessions = stats?.challenges?.[slug]?.gamesPlayed ?? 0;
              const isRightCol = i % 2 === 1;

              return (
                <div key={slug} style={{
                  borderTop: '1px solid #111111',
                  borderLeft: isRightCol ? '1px solid #111111' : 'none',
                  paddingTop: '1rem',
                  paddingBottom: '1.25rem',
                  paddingLeft: isRightCol ? '1.5rem' : '0',
                  paddingRight: isRightCol ? '0' : '1.5rem',
                  marginBottom: i < remainingChallenges.length - 2 ? '0' : '0',
                }}>
                  {/* Tags / category */}
                  {metadata.tags && metadata.tags.length > 0 && (
                    <p style={{ fontVariant: 'small-caps', letterSpacing: '0.07em', fontSize: '0.6rem', color: '#8b0000', fontFamily: 'var(--font-lora), serif', marginBottom: '0.3rem', fontWeight: 600 }}>
                      {[`${metadata.players ?? 2}-player`, ...(metadata.tags ?? [])].join(' · ')}
                    </p>
                  )}
                  {/* Headline */}
                  <h3 style={{
                    fontFamily: 'var(--font-playfair), serif',
                    fontSize: '1.3rem',
                    fontWeight: 800,
                    lineHeight: 1.2,
                    color: '#111111',
                    marginBottom: '0.3rem',
                  }}>
                    {metadata.name}
                  </h3>
                  {/* Deck */}
                  <p style={{
                    fontFamily: 'var(--font-lora), serif',
                    fontStyle: 'italic',
                    fontSize: '0.82rem',
                    lineHeight: 1.6,
                    color: '#555',
                    marginBottom: '0.4rem',
                  }}>
                    {metadata.description.length > 150
                      ? metadata.description.slice(0, 150).trimEnd() + '…'
                      : metadata.description}
                  </p>
                  {/* Byline */}
                  <p style={{
                    fontFamily: 'var(--font-lora), serif',
                    fontSize: '0.65rem',
                    color: '#888',
                    fontStyle: 'italic',
                    marginBottom: '0.6rem',
                    borderTop: '1px solid #eee',
                    paddingTop: '0.3rem',
                  }}>
                    By {authorNames} · {sessions.toLocaleString()} Sessions
                  </p>
                  {/* Read more */}
                  <a href={`/challenges/${slug}`} style={{
                    display: 'inline-block',
                    fontVariant: 'small-caps',
                    letterSpacing: '0.08em',
                    fontSize: '0.65rem',
                    color: '#8b0000',
                    fontFamily: 'var(--font-lora), serif',
                    fontWeight: 700,
                    textDecoration: 'none',
                    borderBottom: '1px solid #8b0000',
                    paddingBottom: '1px',
                  }}>
                    Read More →
                  </a>
                </div>
              );
            })}

            {/* Design a challenge stub */}
            <div style={{
              borderTop: '1px solid #aaa',
              borderLeft: remainingChallenges.length % 2 === 1 ? '1px solid #aaa' : 'none',
              paddingTop: '1rem',
              paddingBottom: '1.25rem',
              paddingLeft: remainingChallenges.length % 2 === 1 ? '1.5rem' : '0',
              paddingRight: remainingChallenges.length % 2 === 1 ? '0' : '1.5rem',
            }}>
              <p style={{ fontVariant: 'small-caps', letterSpacing: '0.07em', fontSize: '0.6rem', color: '#aaa', fontFamily: 'var(--font-lora), serif', marginBottom: '0.3rem', fontWeight: 600 }}>
                Contribute
              </p>
              <h3 style={{
                fontFamily: 'var(--font-playfair), serif',
                fontSize: '1.3rem',
                fontWeight: 800,
                color: '#aaa',
                marginBottom: '0.4rem',
                lineHeight: 1.2,
              }}>
                Design a Challenge
              </h3>
              <p style={{ fontFamily: 'var(--font-lora), serif', fontStyle: 'italic', fontSize: '0.82rem', color: '#bbb', lineHeight: 1.6, marginBottom: '0.6rem' }}>
                We are looking for challenge designers. If you have an idea for a novel multi-agent scenario, reach out.
              </p>
              <a href="https://github.com/nicolapps/arena" style={{
                display: 'inline-block',
                fontVariant: 'small-caps',
                letterSpacing: '0.08em',
                fontSize: '0.65rem',
                color: '#aaa',
                fontFamily: 'var(--font-lora), serif',
                fontWeight: 700,
                textDecoration: 'none',
                borderBottom: '1px solid #aaa',
                paddingBottom: '1px',
              }}>
                Get in Touch →
              </a>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
