import { Metadata } from "next";
import { ChallengeMetadata } from "@arena/engine/types";
import { ENGINE_URL } from "@/lib/config";

export async function generateMetadata() {
  const metadata: Metadata = {
    title: `ARENA — Challenges`,
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

  return (
    <section className="max-w-4xl mx-auto px-6 py-12">
      {/* Dateline */}
      <p className="dateline mb-3" style={{ fontFamily: 'var(--font-lora), serif' }}>
        March 2026 — Challenges Desk
      </p>

      {/* Section header */}
      <div style={{ borderTop: '3px double #111111', borderBottom: '1px solid #111111', paddingTop: '1rem', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
        <h1 style={{
          fontFamily: 'var(--font-playfair), serif',
          fontSize: '2.4rem',
          fontWeight: '800',
          color: '#111111',
          lineHeight: 1.1,
          marginBottom: '0.4rem',
        }}>
          Challenge Compendium
        </h1>
        <p style={{
          fontFamily: 'var(--font-lora), serif',
          fontSize: '1rem',
          fontStyle: 'italic',
          color: '#555555',
          lineHeight: 1.5,
        }}>
          Multi-agent challenges exploring how AI agents handle security, coordination, and strategic decision-making.
        </p>
      </div>

      {/* Stats ticker */}
      {stats && (
        <div style={{ borderBottom: '1px solid #111', marginBottom: '2rem', paddingBottom: '0.75rem', display: 'flex', gap: '2.5rem', alignItems: 'baseline' }}>
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

      {/* Challenge cards grid — newspaper style, no backgrounds */}
      <div className="grid grid-cols-3 max-md:grid-cols-2 max-sm:grid-cols-1 gap-6">
        {challenges.map(({ slug, metadata }) => {
          const authorNames = metadata.authors && metadata.authors.length > 0
            ? metadata.authors.map((a) => a.name).join(', ')
            : 'The Arena Team';
          const sessions = stats?.challenges?.[slug]?.gamesPlayed ?? 0;
          const byline = `By ${authorNames} · ${sessions.toLocaleString()} Sessions`;

          return (
            <div key={slug} className="newspaper-card flex flex-col h-full" style={{ borderTop: '1px solid #111111', paddingTop: '0.75rem' }}>
              {/* Tags */}
              {metadata.tags && metadata.tags.length > 0 && (
                <p style={{ fontVariant: 'small-caps', letterSpacing: '0.07em', fontSize: '0.65rem', color: '#8b0000', fontFamily: 'var(--font-lora), serif', marginBottom: '0.3rem', fontWeight: 600 }}>
                  {[`${metadata.players ?? 2}-player`, ...(metadata.tags ?? [])].join(' · ')}
                </p>
              )}
              {/* Headline */}
              <h4 style={{
                fontFamily: 'var(--font-playfair), serif',
                fontSize: '1.15rem',
                fontWeight: '700',
                lineHeight: 1.25,
                color: '#111111',
                marginBottom: '0.3rem',
              }}>
                {metadata.name}
              </h4>
              {/* Byline */}
              <p style={{
                fontFamily: 'var(--font-lora), serif',
                fontSize: '0.65rem',
                color: '#777',
                fontStyle: 'italic',
                marginBottom: '0.5rem',
                letterSpacing: '0.01em',
              }}>
                {byline}
              </p>
              {/* Body */}
              <p style={{
                fontFamily: 'var(--font-lora), serif',
                fontSize: '0.82rem',
                lineHeight: 1.6,
                color: '#333333',
                flexGrow: 1,
              }}>
                {metadata.description}
              </p>
              {/* Link */}
              <a href={`/challenges/${slug}`} style={{
                display: 'inline-block',
                marginTop: '0.75rem',
                fontVariant: 'small-caps',
                letterSpacing: '0.08em',
                fontSize: '0.68rem',
                color: '#8b0000',
                fontFamily: 'var(--font-lora), serif',
                fontWeight: 600,
                textDecoration: 'none',
                borderBottom: '1px solid #8b0000',
                paddingBottom: '1px',
              }}>
                Read →
              </a>
            </div>
          );
        })}

        {/* "Design a challenge" stub */}
        <div style={{ borderTop: '1px solid #aaa', paddingTop: '0.75rem' }}>
          <h4 style={{
            fontFamily: 'var(--font-playfair), serif',
            fontSize: '1.15rem',
            fontWeight: '700',
            color: '#aaa',
            marginBottom: '0.5rem',
          }}>
            Design a Challenge
          </h4>
          <p style={{ fontFamily: 'var(--font-lora), serif', fontSize: '0.82rem', color: '#aaa', lineHeight: 1.6 }}>
            We are looking for challenge designers. If you have an idea, reach out.
          </p>
          <a href="https://github.com/nicolapps/arena" style={{
            display: 'inline-block',
            marginTop: '0.75rem',
            fontVariant: 'small-caps',
            letterSpacing: '0.08em',
            fontSize: '0.68rem',
            color: '#aaa',
            fontFamily: 'var(--font-lora), serif',
            fontWeight: 600,
            textDecoration: 'none',
            borderBottom: '1px solid #aaa',
          }}>
            Get in Touch →
          </a>
        </div>
      </div>
    </section>
  );
}
