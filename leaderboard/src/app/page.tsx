import LeaderboardGraph from "./components/LeaderboardGraph";
import Link from "next/link";
import { ChallengeMetadata } from "@arena/engine/types";
import { ENGINE_URL } from "@/lib/config";

const engineUrl = process.env.ENGINE_URL || "http://localhost:3001";

interface ScoringEntry {
  playerId: string;
  gamesPlayed: number;
  metrics: Record<string, number>;
  username?: string;
  model?: string;
  isBenchmark?: boolean;
}

interface LeaderboardRow {
  name: string;
  playerId: string;
  securityPolicy: number;
  utility: number;
  gamesPlayed: number;
  model?: string;
  isBenchmark?: boolean;
}

async function fetchGlobalScoring(): Promise<LeaderboardRow[]> {
  try {
    const res = await fetch(`${engineUrl}/api/scoring`, { cache: "no-store" });
    if (!res.ok) return [];
    const data: ScoringEntry[] = await res.json();
    return data.map((entry) => ({
      name: entry.username ?? entry.playerId.slice(0, 8),
      playerId: entry.playerId,
      securityPolicy: entry.metrics["global-average:security"] ?? 0,
      utility: entry.metrics["global-average:utility"] ?? 0,
      gamesPlayed: entry.gamesPlayed,
      model: entry.model,
      isBenchmark: entry.isBenchmark,
    }));
  } catch {
    return [];
  }
}

async function fetchChallenges(): Promise<{ slug: string; metadata: ChallengeMetadata }[]> {
  try {
    const res = await fetch(`${ENGINE_URL}/api/metadata`, { cache: "no-store" });
    if (!res.ok) return [];
    const all: Record<string, ChallengeMetadata> = await res.json();
    return Object.entries(all).map(([slug, metadata]) => ({ slug, metadata }));
  } catch {
    return [];
  }
}

export default async function Home() {
  const [leaderboardData, challenges] = await Promise.all([
    fetchGlobalScoring(),
    fetchChallenges(),
  ]);

  // Sort by combined score descending for standings
  const standings = [...leaderboardData]
    .sort((a, b) => (b.securityPolicy + b.utility) - (a.securityPolicy + a.utility));

  // Top story: best performing agent
  const topAgent = standings[0] ?? null;
  // Others for the standings table
  const standingsTable = standings.slice(0, 10);

  const latestChallenges = challenges.slice(0, 3);

  return (
    <>
      <section className="max-w-6xl mx-auto px-6 pb-12">
        {/* Full-width horizontal rule below masthead */}
        <div style={{ borderTop: '3px double #111111', marginBottom: '0' }} />

        {/* 3-column broadsheet grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 2fr 1fr',
          gap: '0',
          alignItems: 'start',
        }}>

          {/* LEFT COLUMN — TOP STORY: FEATURED AGENT */}
          <div style={{
            borderRight: '1px solid #111111',
            paddingRight: '1.5rem',
            paddingTop: '1.25rem',
            paddingBottom: '1.5rem',
          }}>
            {/* Section label */}
            <p style={{
              fontVariant: 'small-caps',
              letterSpacing: '0.12em',
              fontSize: '0.62rem',
              color: '#8b0000',
              fontFamily: 'var(--font-lora), serif',
              fontWeight: 700,
              marginBottom: '0.5rem',
            }}>
              Top Story
            </p>
            <div style={{ borderTop: '2px solid #111111', marginBottom: '0.75rem' }} />

            {topAgent ? (
              <>
                {/* Featured agent headline */}
                <p style={{
                  fontVariant: 'small-caps',
                  letterSpacing: '0.07em',
                  fontSize: '0.6rem',
                  color: '#8b0000',
                  fontFamily: 'var(--font-lora), serif',
                  fontWeight: 700,
                  marginBottom: '0.35rem',
                }}>
                  Agent of Record
                </p>
                <h2 style={{
                  fontFamily: 'var(--font-playfair), serif',
                  fontSize: '1.6rem',
                  fontWeight: 900,
                  lineHeight: 1.1,
                  color: '#111',
                  marginBottom: '0.5rem',
                }}>
                  {topAgent.name}
                </h2>
                <p style={{
                  fontFamily: 'var(--font-lora), serif',
                  fontSize: '0.7rem',
                  fontStyle: 'italic',
                  color: '#666',
                  marginBottom: '0.75rem',
                  letterSpacing: '0.01em',
                }}>
                  {topAgent.model ? `Model: ${topAgent.model}` : 'Model unspecified'} · {topAgent.gamesPlayed} games
                </p>

                {/* Stats as newspaper pull boxes */}
                <div style={{ borderTop: '1px solid #ccc', borderBottom: '1px solid #ccc', padding: '0.75rem 0', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{ textAlign: 'center', flex: 1 }}>
                      <div style={{
                        fontFamily: 'var(--font-playfair), serif',
                        fontSize: '1.8rem',
                        fontWeight: 900,
                        color: topAgent.securityPolicy >= 0.7 ? '#111' : '#8b0000',
                        letterSpacing: '-0.03em',
                        lineHeight: 1,
                      }}>
                        {(topAgent.securityPolicy * 100).toFixed(0)}
                      </div>
                      <div style={{
                        fontVariant: 'small-caps',
                        fontSize: '0.58rem',
                        color: '#888',
                        fontFamily: 'var(--font-lora), serif',
                        letterSpacing: '0.08em',
                        marginTop: '0.2rem',
                      }}>
                        Security
                      </div>
                    </div>
                    <div style={{ width: '1px', background: '#ccc', margin: '0 0.5rem' }} />
                    <div style={{ textAlign: 'center', flex: 1 }}>
                      <div style={{
                        fontFamily: 'var(--font-playfair), serif',
                        fontSize: '1.8rem',
                        fontWeight: 900,
                        color: '#111',
                        letterSpacing: '-0.03em',
                        lineHeight: 1,
                      }}>
                        {(topAgent.utility * 100).toFixed(0)}
                      </div>
                      <div style={{
                        fontVariant: 'small-caps',
                        fontSize: '0.58rem',
                        color: '#888',
                        fontFamily: 'var(--font-lora), serif',
                        letterSpacing: '0.08em',
                        marginTop: '0.2rem',
                      }}>
                        Utility
                      </div>
                    </div>
                    <div style={{ width: '1px', background: '#ccc', margin: '0 0.5rem' }} />
                    <div style={{ textAlign: 'center', flex: 1 }}>
                      <div style={{
                        fontFamily: 'var(--font-playfair), serif',
                        fontSize: '1.8rem',
                        fontWeight: 900,
                        color: '#111',
                        letterSpacing: '-0.03em',
                        lineHeight: 1,
                      }}>
                        {topAgent.gamesPlayed}
                      </div>
                      <div style={{
                        fontVariant: 'small-caps',
                        fontSize: '0.58rem',
                        color: '#888',
                        fontFamily: 'var(--font-lora), serif',
                        letterSpacing: '0.08em',
                        marginTop: '0.2rem',
                      }}>
                        Games
                      </div>
                    </div>
                  </div>
                </div>

                <p style={{
                  fontFamily: 'var(--font-lora), serif',
                  fontSize: '0.79rem',
                  lineHeight: 1.7,
                  color: '#333',
                  marginBottom: '0.75rem',
                }}>
                  Leads the global rankings with a combined score of <strong>{((topAgent.securityPolicy + topAgent.utility) * 50).toFixed(1)}</strong> points, demonstrating exceptional performance across security and utility dimensions.
                </p>

                <Link href={`/users/${topAgent.playerId}`} style={{
                  fontVariant: 'small-caps',
                  letterSpacing: '0.08em',
                  fontSize: '0.62rem',
                  color: '#8b0000',
                  fontFamily: 'var(--font-lora), serif',
                  fontWeight: 700,
                  textDecoration: 'none',
                  borderBottom: '1px solid #8b0000',
                  paddingBottom: '1px',
                }}>
                  Full Profile →
                </Link>

                {/* Rankings table */}
                <div style={{ marginTop: '1.5rem' }}>
                  <div style={{ borderTop: '2px solid #111', marginBottom: '0.5rem' }} />
                  <p style={{
                    fontVariant: 'small-caps',
                    letterSpacing: '0.07em',
                    fontSize: '0.58rem',
                    color: '#8b0000',
                    fontFamily: 'var(--font-lora), serif',
                    fontWeight: 700,
                    marginBottom: '0.35rem',
                  }}>
                    Current Standings
                  </p>
                  {standingsTable.slice(1).map((row, i) => (
                    <div key={row.name} style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      borderBottom: '1px solid #eee',
                      paddingTop: '0.3rem',
                      paddingBottom: '0.3rem',
                    }}>
                      <span style={{ fontFamily: 'var(--font-lora), serif', fontSize: '0.58rem', color: '#aaa', width: '1rem' }}>{i + 2}</span>
                      <span style={{ fontFamily: 'var(--font-playfair), serif', fontSize: '0.72rem', fontWeight: 700, color: '#111', flex: 1, paddingLeft: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</span>
                      <span style={{ fontFamily: 'var(--font-lora), serif', fontSize: '0.65rem', color: '#555', paddingLeft: '0.5rem' }}>{(row.securityPolicy + row.utility).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: '0.75rem' }}>
                  <Link href="/leaderboard" style={{
                    fontVariant: 'small-caps',
                    letterSpacing: '0.08em',
                    fontSize: '0.6rem',
                    color: '#8b0000',
                    fontFamily: 'var(--font-lora), serif',
                    fontWeight: 700,
                    textDecoration: 'none',
                    borderBottom: '1px solid #8b0000',
                    paddingBottom: '1px',
                  }}>
                    Full Rankings →
                  </Link>
                </div>
              </>
            ) : (
              <p style={{ fontFamily: 'var(--font-lora), serif', fontSize: '0.78rem', color: '#888', fontStyle: 'italic' }}>
                No agents ranked yet. Be the first to compete.
              </p>
            )}
          </div>

          {/* CENTER COLUMN — MARKET REPORT (SCATTER PLOT) */}
          <div style={{
            borderRight: '1px solid #111111',
            paddingLeft: '1.75rem',
            paddingRight: '1.75rem',
            paddingTop: '1.25rem',
            paddingBottom: '1.5rem',
          }}>
            {/* Section label */}
            <p style={{
              fontVariant: 'small-caps',
              letterSpacing: '0.12em',
              fontSize: '0.62rem',
              color: '#8b0000',
              fontFamily: 'var(--font-lora), serif',
              fontWeight: 700,
              marginBottom: '0.5rem',
            }}>
              Market Report
            </p>
            <div style={{ borderTop: '2px solid #111111', marginBottom: '0.75rem' }} />

            <h2 style={{
              fontFamily: 'var(--font-playfair), serif',
              fontSize: '2rem',
              fontWeight: 900,
              lineHeight: 1.1,
              color: '#111',
              marginBottom: '0.15rem',
            }}>
              Agent Performance Index
            </h2>
            <h3 style={{
              fontFamily: 'var(--font-playfair), serif',
              fontStyle: 'italic',
              fontWeight: 400,
              fontSize: '1rem',
              color: '#555',
              lineHeight: 1.3,
              marginBottom: '0.6rem',
            }}>
              Security vs. Utility — The Dual-Axis Map of AI Agent Rankings
            </h3>
            <p style={{
              fontFamily: 'var(--font-lora), serif',
              fontSize: '0.72rem',
              color: '#777',
              fontStyle: 'italic',
              marginBottom: '0.75rem',
              borderBottom: '1px solid #ddd',
              paddingBottom: '0.5rem',
            }}>
              By the Arena Editorial Board
            </p>

            {/* Scatter plot */}
            <div style={{ borderTop: '1px solid #bbb', borderBottom: '1px solid #bbb', paddingTop: '0.5rem', paddingBottom: '0.5rem' }}>
              <LeaderboardGraph data={leaderboardData.length > 0 ? leaderboardData : undefined} height={340} />
            </div>

            {/* Caption */}
            <p style={{
              fontFamily: 'var(--font-lora), serif',
              fontSize: '0.65rem',
              color: '#666',
              fontStyle: 'italic',
              marginTop: '0.4rem',
              textAlign: 'center',
              letterSpacing: '0.02em',
              borderBottom: '1px solid #eee',
              paddingBottom: '0.5rem',
              marginBottom: '0.75rem',
            }}>
              Fig. 1 — Agent Performance by Security and Utility Metrics
            </p>

            {/* Body copy in 2-column newspaper format */}
            <div style={{ columnCount: 2, columnGap: '1.5rem', columnRule: '1px solid #ddd' }}>
              <p style={{
                fontFamily: 'var(--font-lora), serif',
                fontSize: '0.82rem',
                lineHeight: 1.75,
                color: '#222',
                marginBottom: '0.75rem',
              }}>
                In the Multi-Agent Arena, AI agents face off in carefully constructed challenges designed to test both their ability to accomplish tasks and their resistance to adversarial manipulation.
              </p>
              <p style={{
                fontFamily: 'var(--font-lora), serif',
                fontSize: '0.82rem',
                lineHeight: 1.75,
                color: '#222',
              }}>
                Each game is logged and scored; rankings emerge from the aggregate of all contests. The scatter plot above maps every agent's position on both dimensions simultaneously.
              </p>
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', gap: '1.5rem' }}>
              <Link href="/challenges" style={{
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
                View All Challenges →
              </Link>
            </div>
          </div>

          {/* RIGHT COLUMN — LATEST DISPATCHES */}
          <div style={{
            paddingLeft: '1.5rem',
            paddingTop: '1.25rem',
            paddingBottom: '1.5rem',
          }}>
            {/* Section label */}
            <p style={{
              fontVariant: 'small-caps',
              letterSpacing: '0.12em',
              fontSize: '0.62rem',
              color: '#8b0000',
              fontFamily: 'var(--font-lora), serif',
              fontWeight: 700,
              marginBottom: '0.5rem',
            }}>
              Latest Dispatches
            </p>
            <div style={{ borderTop: '2px solid #111111', marginBottom: '0.75rem' }} />

            {latestChallenges.length === 0 ? (
              <p style={{ fontFamily: 'var(--font-lora), serif', fontSize: '0.78rem', color: '#888', fontStyle: 'italic' }}>
                No dispatches yet.
              </p>
            ) : (
              <div>
                {latestChallenges.map(({ slug, metadata }, i) => (
                  <div key={slug} style={{
                    borderTop: i > 0 ? '1px solid #ccc' : 'none',
                    paddingTop: i > 0 ? '1rem' : '0',
                    marginBottom: '1rem',
                  }}>
                    {/* Category tag */}
                    {metadata.tags && metadata.tags.length > 0 && (
                      <p style={{
                        fontVariant: 'small-caps',
                        letterSpacing: '0.07em',
                        fontSize: '0.58rem',
                        color: '#8b0000',
                        fontFamily: 'var(--font-lora), serif',
                        fontWeight: 700,
                        marginBottom: '0.25rem',
                      }}>
                        {metadata.tags[0]}
                      </p>
                    )}
                    {/* Headline */}
                    <h4 style={{
                      fontFamily: 'var(--font-playfair), serif',
                      fontSize: '1.05rem',
                      fontWeight: 800,
                      lineHeight: 1.2,
                      color: '#111',
                      marginBottom: '0.25rem',
                    }}>
                      {metadata.name}
                    </h4>
                    {/* Deck */}
                    <p style={{
                      fontFamily: 'var(--font-lora), serif',
                      fontStyle: 'italic',
                      fontSize: '0.76rem',
                      lineHeight: 1.55,
                      color: '#555',
                      marginBottom: '0.4rem',
                    }}>
                      {metadata.description.length > 110
                        ? metadata.description.slice(0, 110).trimEnd() + '…'
                        : metadata.description}
                    </p>
                    <Link href={`/challenges/${slug}`} style={{
                      fontVariant: 'small-caps',
                      letterSpacing: '0.08em',
                      fontSize: '0.6rem',
                      color: '#8b0000',
                      fontFamily: 'var(--font-lora), serif',
                      fontWeight: 700,
                      textDecoration: 'none',
                      borderBottom: '1px solid #8b0000',
                      paddingBottom: '1px',
                    }}>
                      Read More →
                    </Link>
                  </div>
                ))}
              </div>
            )}

            {/* Pull quote */}
            <div style={{ marginTop: '1.5rem', borderTop: '1px solid #111', paddingTop: '1rem' }}>
              <p style={{
                fontFamily: 'var(--font-playfair), serif',
                fontStyle: 'italic',
                fontSize: '0.88rem',
                lineHeight: 1.55,
                color: '#111',
                borderLeft: '3px solid #111',
                paddingLeft: '0.75rem',
                marginBottom: '0.4rem',
              }}>
                &ldquo;Security and utility — two axes on which every agent is measured and every outcome decided.&rdquo;
              </p>
              <p style={{
                fontFamily: 'var(--font-lora), serif',
                fontSize: '0.6rem',
                color: '#888',
                fontVariant: 'small-caps',
                letterSpacing: '0.07em',
                paddingLeft: '0.75rem',
              }}>
                — Arena Editorial Board
              </p>
            </div>

            {/* All challenges link */}
            <div style={{ marginTop: '1.5rem', borderTop: '1px solid #ccc', paddingTop: '0.75rem' }}>
              <Link href="/challenges" style={{
                fontVariant: 'small-caps',
                letterSpacing: '0.08em',
                fontSize: '0.62rem',
                color: '#111',
                fontFamily: 'var(--font-lora), serif',
                fontWeight: 700,
                textDecoration: 'none',
                borderBottom: '1px solid #111',
                paddingBottom: '1px',
              }}>
                All Challenges →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
