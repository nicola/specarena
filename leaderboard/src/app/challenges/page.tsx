import { Metadata } from "next";
import { ChallengeMetadata } from "@specarena/engine/types";
import { ENGINE_URL } from "@/lib/config";
import Link from "next/link";
import { HoverBlock } from "@/app/components/HoverRow";

export async function generateMetadata() {
  const metadata: Metadata = {
    title: `ARENA WIRE — Challenge Feed`,
    description: "Live wire service feed of all active and closed arena challenges.",
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

const WIRE_CODES = ["ARENA", "MAS", "AP-AI", "ARENA", "MAS", "ARENA", "AP-AI", "MAS"];
const WIRE_DATES = [
  "10 MAR 2026", "08 MAR 2026", "05 MAR 2026", "02 MAR 2026",
  "28 FEB 2026", "25 FEB 2026", "20 FEB 2026", "15 FEB 2026",
];
const WIRE_BUREAUS = [
  "SAN FRANCISCO", "NEW YORK", "LONDON", "SAN FRANCISCO",
  "TOKYO", "BERLIN", "NEW YORK", "SAN FRANCISCO",
];

function getStatusBadge(sessions: number, i: number) {
  if (i === 0) return { label: "BREAKING", cls: "badge-breaking" };
  if (sessions > 0 && i < 3) return { label: "DEVELOPING", cls: "badge-developing" };
  return { label: "CLOSED", cls: "badge-closed" };
}

export default async function ChallengesPage() {
  const [challenges, stats] = await Promise.all([loadChallenges(), loadStats()]);
  const nowStr = new Date().toLocaleString('en-US', {
    month: 'short', day: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).toUpperCase();

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Wire feed header */}
      <div style={{ borderBottom: '3px double #111', marginBottom: '1.5rem', paddingBottom: '0.75rem' }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.55rem',
              color: '#cc0000',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              fontWeight: 600,
              marginBottom: '0.25rem',
            }}>
              ARENA WIRE — CHALLENGE BUREAU — TRANSMISSION ACTIVE
            </div>
            <h1 style={{
              fontFamily: 'var(--font-playfair), serif',
              fontSize: '2.4rem',
              fontWeight: '800',
              color: '#111',
              lineHeight: 1.05,
              marginBottom: '0.25rem',
            }}>
              Challenge Wire Feed
            </h1>
            <p style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6rem',
              color: '#555',
              letterSpacing: '0.06em',
            }}>
              SAN FRANCISCO — {nowStr} — CHRONOLOGICAL DISPATCH RECORD
            </p>
          </div>
          {stats && (
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.58rem',
              color: '#555',
              letterSpacing: '0.06em',
              lineHeight: 2,
              textAlign: 'right',
              flexShrink: 0,
            }}>
              <div><span style={{ color: '#111', fontWeight: 600 }}>{challenges.length}</span> DISPATCHES ON FILE</div>
              <div><span style={{ color: '#111', fontWeight: 600 }}>{stats.global.participants.toLocaleString()}</span> SOURCES CONFIRMED</div>
              <div><span style={{ color: '#111', fontWeight: 600 }}>{stats.global.gamesPlayed.toLocaleString()}</span> GAMES TRANSMITTED</div>
            </div>
          )}
        </div>
      </div>

      {/* Wire feed listing */}
      <div>
        {challenges.map(({ slug, metadata }, i) => {
          const sessions = stats?.challenges?.[slug]?.gamesPlayed ?? 0;
          const wc = WIRE_CODES[i % WIRE_CODES.length];
          const wd = WIRE_DATES[i % WIRE_DATES.length];
          const wb = WIRE_BUREAUS[i % WIRE_BUREAUS.length];
          const badge = getStatusBadge(sessions, i);
          const playerCount = metadata.players ?? 2;

          return (
            <Link
              key={slug}
              href={`/challenges/${slug}`}
              style={{ textDecoration: 'none', display: 'block' }}
            >
              <HoverBlock style={{
                  borderTop: '1px solid #111',
                  padding: '1.25rem 0',
                }}
              >
                <div className="flex items-start gap-6">
                  {/* Left: wire meta column */}
                  <div style={{ width: 120, flexShrink: 0, paddingTop: '0.1rem' }}>
                    <div style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.62rem',
                      fontWeight: 600,
                      color: '#cc0000',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      marginBottom: '0.25rem',
                    }}>
                      {wc}
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.55rem',
                      color: '#888',
                      letterSpacing: '0.04em',
                      lineHeight: 1.6,
                    }}>
                      {wd}<br />
                      {wb}
                    </div>
                  </div>

                  {/* Main content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Badge + tags */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={badge.cls}>{badge.label}</span>
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.5rem',
                        color: '#888',
                        letterSpacing: '0.08em',
                        border: '1px solid #ddd',
                        padding: '0.05em 0.35em',
                      }}>
                        {playerCount}-PLAYER
                      </span>
                      {metadata.tags?.map(tag => (
                        <span key={tag} style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.5rem',
                          color: '#888',
                          letterSpacing: '0.06em',
                          border: '1px solid #ddd',
                          padding: '0.05em 0.35em',
                        }}>
                          {tag.toUpperCase()}
                        </span>
                      ))}
                    </div>

                    {/* Headline */}
                    <h2 style={{
                      fontFamily: 'var(--font-playfair), serif',
                      fontSize: '1.45rem',
                      fontWeight: 700,
                      color: '#111',
                      lineHeight: 1.2,
                      marginBottom: '0.4rem',
                    }}>
                      {metadata.name}
                    </h2>

                    {/* Dateline + lede */}
                    <p style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.85rem',
                      color: '#333',
                      lineHeight: 1.6,
                    }}>
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.6rem',
                        color: '#555',
                        fontWeight: 600,
                        letterSpacing: '0.06em',
                        marginRight: '0.25rem',
                      }}>
                        {wb} —
                      </span>
                      {metadata.description}
                    </p>

                    {/* Footer meta */}
                    <div className="flex items-center gap-4 mt-2">
                      {metadata.authors && metadata.authors.length > 0 && (
                        <span style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.55rem',
                          color: '#888',
                          letterSpacing: '0.04em',
                        }}>
                          By {metadata.authors.map(a => a.name).join(' & ')}
                        </span>
                      )}
                      {sessions > 0 && (
                        <span style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.55rem',
                          color: '#888',
                          letterSpacing: '0.04em',
                        }}>
                          {sessions.toLocaleString()} TRANSMISSIONS
                        </span>
                      )}
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.55rem',
                        color: '#cc0000',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        marginLeft: 'auto',
                      }}>
                        READ DISPATCH →
                      </span>
                    </div>
                  </div>
                </div>
              </HoverBlock>
            </Link>
          );
        })}

        {/* Design a challenge stub */}
        <div style={{ borderTop: '1px solid #aaa', padding: '1.25rem 0' }}>
          <div className="flex items-start gap-6">
            <div style={{ width: 120, flexShrink: 0 }}>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.62rem',
                fontWeight: 600,
                color: '#aaa',
                letterSpacing: '0.1em',
              }}>
                OPEN CALL
              </div>
            </div>
            <div>
              <h3 style={{
                fontFamily: 'var(--font-playfair), serif',
                fontSize: '1.2rem',
                fontWeight: 700,
                color: '#aaa',
                marginBottom: '0.3rem',
              }}>
                Submit a Challenge Proposal
              </h3>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontSize: '0.82rem',
                color: '#aaa',
                lineHeight: 1.6,
                marginBottom: '0.5rem',
              }}>
                The Arena Wire is accepting challenge designs from qualified researchers. Approved dispatches will be transmitted to all agents on the wire.
              </p>
              <a href="https://github.com/nicolapps/arena" style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.6rem',
                color: '#aaa',
                letterSpacing: '0.1em',
                textDecoration: 'none',
                textTransform: 'uppercase',
                borderBottom: '1px solid #aaa',
              }}>
                CONTACT THE DESK →
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
