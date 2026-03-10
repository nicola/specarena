import Link from "next/link";
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

// Map tags to desk names
const TAG_TO_DESK: Record<string, string> = {
  "cryptography": "CRYPTOGRAPHY DESK",
  "game theory": "GAME THEORY DESK",
  "economics": "ECONOMICS DESK",
  "security": "SECURITY DESK",
  "negotiation": "NEGOTIATION DESK",
};

// Ordered list of desks
const DESK_ORDER = [
  "CRYPTOGRAPHY DESK",
  "GAME THEORY DESK",
  "ECONOMICS DESK",
  "SECURITY DESK",
  "NEGOTIATION DESK",
];

function getDesk(tags?: string[]): string {
  if (!tags || tags.length === 0) return "OTHER";
  for (const tag of tags) {
    const desk = TAG_TO_DESK[tag.toLowerCase()];
    if (desk) return desk;
  }
  return "OTHER";
}

function formatDateline(players?: number): string {
  return `MARCH 2026 · ${players ?? 2} PLAYER${(players ?? 2) !== 1 ? "S" : ""}`;
}

function getLede(description: string): string {
  // Return first sentence
  const match = description.match(/^[^.!?]+[.!?]/);
  return match ? match[0] : description.slice(0, 120) + (description.length > 120 ? "…" : "");
}

interface DeskBannerProps {
  name: string;
}

function DeskBanner({ name }: DeskBannerProps) {
  // Split "CRYPTOGRAPHY DESK" into prefix + "DESK"
  const parts = name.split(" DESK");
  const prefix = parts[0].trim();

  return (
    <div style={{
      display: 'flex',
      alignItems: 'stretch',
      background: '#111111',
      border: '1px solid #8b0000',
      marginBottom: '0',
    }}>
      <div style={{
        flex: 1,
        padding: '0.5rem 1rem',
        display: 'flex',
        alignItems: 'center',
      }}>
        <span style={{
          fontFamily: 'var(--font-playfair), serif',
          fontWeight: 800,
          fontSize: '0.85rem',
          color: '#ffffff',
          letterSpacing: '0.2em',
        }}>
          {prefix}
        </span>
      </div>
      <div style={{
        background: '#8b0000',
        padding: '0.5rem 1rem',
        display: 'flex',
        alignItems: 'center',
      }}>
        <span style={{
          fontFamily: 'var(--font-playfair), serif',
          fontWeight: 800,
          fontSize: '0.85rem',
          color: '#ffffff',
          letterSpacing: '0.2em',
        }}>
          DESK
        </span>
      </div>
    </div>
  );
}

interface EditorialEntryProps {
  slug: string;
  title: string;
  players?: number;
  description: string;
  isLast: boolean;
}

function EditorialEntry({ slug, title, players, description, isLast }: EditorialEntryProps) {
  return (
    <div>
      <div style={{
        borderTop: '1px solid #aaa',
        paddingTop: '1rem',
        paddingBottom: isLast ? 0 : '1rem',
      }}>
        <Link href={`/challenges/${slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <p style={{
            fontFamily: 'var(--font-lora), serif',
            fontVariant: 'small-caps',
            letterSpacing: '0.1em',
            fontSize: '0.65rem',
            color: '#8b0000',
            marginBottom: '0.3rem',
          }}>
            {formatDateline(players)}
          </p>
          <h3 style={{
            fontFamily: 'var(--font-playfair), serif',
            fontSize: '1.25rem',
            fontWeight: 700,
            color: '#111111',
            lineHeight: 1.2,
            marginBottom: '0.4rem',
          }}>
            {title}
          </h3>
          <p style={{
            fontFamily: 'var(--font-lora), serif',
            fontSize: '0.85rem',
            lineHeight: 1.65,
            color: '#444',
          }}>
            {getLede(description)}
          </p>
          <p style={{
            fontFamily: 'var(--font-lora), serif',
            fontVariant: 'small-caps',
            letterSpacing: '0.07em',
            fontSize: '0.65rem',
            color: '#8b0000',
            marginTop: '0.5rem',
          }}>
            Read More →
          </p>
        </Link>
      </div>
    </div>
  );
}

export default async function ChallengesPage() {
  const [challenges, stats] = await Promise.all([loadChallenges(), loadStats()]);

  // Group challenges by desk
  const deskMap: Record<string, { slug: string; metadata: ChallengeMetadata }[]> = {};
  for (const ch of challenges) {
    const desk = getDesk(ch.metadata.tags);
    if (!deskMap[desk]) deskMap[desk] = [];
    deskMap[desk].push(ch);
  }

  // Build ordered desks (only those with entries)
  const orderedDesks = DESK_ORDER.filter(d => deskMap[d] && deskMap[d].length > 0);
  // Add any "OTHER" desk at the end
  if (deskMap["OTHER"] && deskMap["OTHER"].length > 0) {
    orderedDesks.push("OTHER");
  }

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
        <div style={{ borderBottom: '1px solid #111', marginBottom: '2.5rem', paddingBottom: '0.75rem', display: 'flex', gap: '2.5rem', alignItems: 'baseline' }}>
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

      {/* Section Desk Grouping */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
        {orderedDesks.map((desk) => {
          const entries = deskMap[desk];
          return (
            <div key={desk}>
              <DeskBanner name={desk === "OTHER" ? "OTHER DESK" : desk} />
              <div style={{
                border: '1px solid #8b0000',
                borderTop: 'none',
                padding: '1.25rem 1.5rem',
                display: 'grid',
                gridTemplateColumns: entries.length === 1 ? '1fr' : entries.length === 2 ? '1fr 1fr' : '1fr 1fr 1fr',
                gap: '0 2rem',
              }}>
                {entries.map(({ slug, metadata }, idx) => (
                  <EditorialEntry
                    key={slug}
                    slug={slug}
                    title={metadata.name}
                    players={metadata.players}
                    description={metadata.description}
                    isLast={idx === entries.length - 1}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* "Design a challenge" stub */}
      <div style={{ borderTop: '3px double #111', marginTop: '3rem', paddingTop: '1.5rem' }}>
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
    </section>
  );
}
