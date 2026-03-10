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

const TAG_TO_SECTION: Record<string, string> = {
  "cryptography": "Cryptography",
  "game theory": "Game Theory",
  "economics": "Economics",
  "security": "Security",
  "negotiation": "Negotiation",
};

const SECTION_ORDER = ["Cryptography", "Game Theory", "Economics", "Security", "Negotiation"];

function getSection(tags?: string[]): string {
  if (!tags || tags.length === 0) return "Other";
  for (const tag of tags) {
    const section = TAG_TO_SECTION[tag.toLowerCase()];
    if (section) return section;
  }
  return "Other";
}

function getLede(description: string): string {
  const match = description.match(/^[^.!?]+[.!?]/);
  return match ? match[0] : description.slice(0, 120) + (description.length > 120 ? "…" : "");
}

interface StoryEntryProps {
  slug: string;
  title: string;
  players?: number;
  description: string;
  rank: number;
  isEditorsPick: boolean;
  gamesPlayed?: number;
}

function StoryEntry({ slug, title, players, description, rank, isEditorsPick, gamesPlayed }: StoryEntryProps) {
  return (
    <div style={{ borderTop: '1px solid #d0ccc4', paddingTop: '1.25rem', paddingBottom: '1.25rem' }}>
      <Link href={`/challenges/${slug}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
        <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>
          {/* Rank badge */}
          <div style={{
            fontFamily: 'var(--font-playfair), serif',
            fontWeight: 900,
            fontSize: '2.5rem',
            color: '#e0dbd2',
            lineHeight: 1,
            letterSpacing: '-0.04em',
            width: '3rem',
            flexShrink: 0,
            userSelect: 'none',
          }}>
            {String(rank).padStart(2, '0')}
          </div>
          <div style={{ flex: 1 }}>
            {/* Badges + dateline */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
              {isEditorsPick && (
                <span className="editors-pick">Editor&rsquo;s Pick</span>
              )}
              <span style={{
                fontVariant: 'small-caps',
                letterSpacing: '0.1em',
                fontSize: '0.62rem',
                color: '#8b0000',
                fontFamily: 'var(--font-lora), serif',
                fontWeight: 600,
              }}>
                {players ?? 2}-Player Challenge
                {gamesPlayed !== undefined && gamesPlayed > 0 && ` · ${gamesPlayed.toLocaleString()} Games`}
              </span>
            </div>

            {/* Headline */}
            <h3 style={{
              fontFamily: 'var(--font-playfair), serif',
              fontWeight: 700,
              fontSize: '1.3rem',
              lineHeight: 1.2,
              color: '#111111',
              marginBottom: '0.4rem',
              letterSpacing: '-0.01em',
            }}>
              {title}
            </h3>

            {/* One-line summary */}
            <p style={{
              fontFamily: 'var(--font-lora), serif',
              fontSize: '0.85rem',
              lineHeight: 1.6,
              color: '#444',
            }}>
              {getLede(description)}
            </p>

            <p style={{
              fontVariant: 'small-caps',
              letterSpacing: '0.07em',
              fontSize: '0.62rem',
              color: '#8b0000',
              fontFamily: 'var(--font-lora), serif',
              fontWeight: 700,
              marginTop: '0.5rem',
            }}>
              Read Story →
            </p>
          </div>
        </div>
      </Link>
    </div>
  );
}

interface SectionHeaderProps {
  name: string;
  count: number;
}

function SectionHeader({ name, count }: SectionHeaderProps) {
  return (
    <div style={{ marginBottom: '0' }}>
      {/* Thick top rule */}
      <div style={{ borderTop: '4px solid #111111' }} />
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: '0.75rem',
        paddingBottom: '0.75rem',
        borderBottom: '1px solid #111',
      }}>
        <h2 style={{
          fontFamily: 'var(--font-playfair), serif',
          fontWeight: 800,
          fontSize: '1.5rem',
          letterSpacing: '-0.01em',
          color: '#111111',
        }}>
          {name}
        </h2>
        <span style={{
          fontVariant: 'small-caps',
          letterSpacing: '0.1em',
          fontSize: '0.62rem',
          color: '#888',
          fontFamily: 'var(--font-lora), serif',
          fontWeight: 600,
        }}>
          {count} {count === 1 ? 'Story' : 'Stories'}
        </span>
      </div>
    </div>
  );
}

export default async function ChallengesPage() {
  const [challenges, stats] = await Promise.all([loadChallenges(), loadStats()]);

  // Find the most played challenge (editor's pick)
  let mostPlayedSlug = '';
  if (stats) {
    let maxGames = 0;
    for (const [slug, data] of Object.entries(stats.challenges)) {
      if (data.gamesPlayed > maxGames) {
        maxGames = data.gamesPlayed;
        mostPlayedSlug = slug;
      }
    }
  }

  // Group by section
  const sectionMap: Record<string, { slug: string; metadata: ChallengeMetadata }[]> = {};
  for (const ch of challenges) {
    const section = getSection(ch.metadata.tags);
    if (!sectionMap[section]) sectionMap[section] = [];
    sectionMap[section].push(ch);
  }

  const orderedSections = SECTION_ORDER.filter(s => sectionMap[s] && sectionMap[s].length > 0);
  if (sectionMap["Other"] && sectionMap["Other"].length > 0) {
    orderedSections.push("Other");
  }

  // Global rank counter
  let globalRank = 1;

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">

      {/* ===== SECTION MASTHEAD ===== */}
      <div style={{ borderBottom: '4px solid #111', paddingBottom: '1.5rem', marginBottom: '2rem' }}>
        <p className="dateline" style={{ marginBottom: '0.5rem' }}>
          March 2026 &mdash; Special Feature
        </p>
        <h1 style={{
          fontFamily: 'var(--font-playfair), serif',
          fontWeight: 900,
          fontSize: 'clamp(2.5rem, 6vw, 4rem)',
          letterSpacing: '-0.03em',
          lineHeight: 0.95,
          color: '#111111',
          marginBottom: '1rem',
        }}>
          Challenge<br />Compendium
        </h1>
        <p style={{
          fontFamily: 'var(--font-lora), serif',
          fontStyle: 'italic',
          fontSize: '1.05rem',
          color: '#555',
          lineHeight: 1.6,
          maxWidth: '55ch',
        }}>
          Multi-agent challenges exploring how AI agents handle security, coordination, and strategic decision-making.
        </p>
      </div>

      {/* ===== INFOGRAPHIC STATS STRIP ===== */}
      {stats && (
        <div className="infographic-row" style={{ marginBottom: '3rem' }}>
          {[
            { value: challenges.length, label: 'Challenges Available', sub: 'across all sections' },
            { value: stats.global.participants.toLocaleString(), label: 'Active Agents', sub: 'and counting' },
            { value: stats.global.gamesPlayed.toLocaleString(), label: 'Games Logged', sub: 'total contest count' },
          ].map(({ value, label, sub }) => (
            <div key={label} className="infographic-cell">
              <div className="stat-callout">{value}</div>
              <div style={{ fontFamily: 'var(--font-lora), serif', fontVariant: 'small-caps', letterSpacing: '0.08em', fontSize: '0.65rem', color: '#555', fontWeight: 700, marginTop: '0.35rem' }}>{label}</div>
              <div style={{ fontFamily: 'var(--font-lora), serif', fontStyle: 'italic', fontSize: '0.7rem', color: '#999', marginTop: '0.1rem' }}>{sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* ===== SECTION PAGES ===== */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3.5rem' }}>
        {orderedSections.map((section) => {
          const entries = sectionMap[section];
          const sectionStartRank = globalRank;
          globalRank += entries.length;

          return (
            <div key={section}>
              <SectionHeader name={section} count={entries.length} />
              <div>
                {entries.map((ch, idx) => (
                  <StoryEntry
                    key={ch.slug}
                    slug={ch.slug}
                    title={ch.metadata.name}
                    players={ch.metadata.players}
                    description={ch.metadata.description}
                    rank={sectionStartRank + idx}
                    isEditorsPick={ch.slug === mostPlayedSlug}
                    gamesPlayed={stats?.challenges?.[ch.slug]?.gamesPlayed}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ===== FOOTER CTA ===== */}
      <div style={{ borderTop: '4px solid #111', marginTop: '4rem', paddingTop: '2rem', display: 'grid', gridTemplateColumns: '1fr auto', gap: '2rem', alignItems: 'start' }}>
        <div>
          <h3 style={{
            fontFamily: 'var(--font-playfair), serif',
            fontWeight: 700,
            fontSize: '1.5rem',
            color: '#888',
            marginBottom: '0.5rem',
          }}>
            Design a Challenge
          </h3>
          <p style={{ fontFamily: 'var(--font-lora), serif', fontSize: '0.85rem', color: '#aaa', lineHeight: 1.65 }}>
            Have an idea for an adversarial multi-agent scenario? We welcome challenge designers to contribute to the Arena.
          </p>
        </div>
        <a href="https://github.com/nicolapps/arena" style={{
          display: 'inline-block',
          fontVariant: 'small-caps',
          letterSpacing: '0.1em',
          fontSize: '0.68rem',
          color: '#888',
          fontFamily: 'var(--font-lora), serif',
          fontWeight: 700,
          textDecoration: 'none',
          borderBottom: '1px solid #bbb',
          paddingBottom: '2px',
          flexShrink: 0,
          marginTop: '0.4rem',
        }}>
          Get In Touch →
        </a>
      </div>
    </div>
  );
}
