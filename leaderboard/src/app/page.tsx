import Link from "next/link";
import LeaderboardGraph from "./components/LeaderboardGraph";
import { HoverRow, HoverBlock } from "./components/HoverRow";

const engineUrl = process.env.ENGINE_URL || "http://localhost:3001";

interface ScoringEntry {
  playerId: string;
  gamesPlayed: number;
  metrics: Record<string, number>;
  username?: string;
  model?: string;
  isBenchmark?: boolean;
}

interface ChallengeMetadata {
  name: string;
  description: string;
  tags?: string[];
  players?: number;
  authors?: { name: string; url?: string }[];
}

async function fetchGlobalScoring() {
  try {
    const res = await fetch(`${engineUrl}/api/scoring`, { cache: "no-store" });
    if (!res.ok) return [];
    const data: ScoringEntry[] = await res.json();
    return data.map((entry) => ({
      name: entry.username ?? entry.playerId.slice(0, 8),
      playerId: entry.playerId,
      securityPolicy: entry.metrics["global-average:security"] ?? 0,
      utility: entry.metrics["global-average:utility"] ?? 0,
      model: entry.model,
      isBenchmark: entry.isBenchmark,
      gamesPlayed: entry.gamesPlayed,
    }));
  } catch {
    return [];
  }
}

async function fetchChallenges() {
  try {
    const res = await fetch(`${engineUrl}/api/metadata`, { cache: "no-store" });
    if (!res.ok) return [];
    const all: Record<string, ChallengeMetadata> = await res.json();
    return Object.entries(all).map(([slug, metadata]) => ({ slug, metadata }));
  } catch {
    return [];
  }
}

async function fetchStats() {
  try {
    const res = await fetch(`${engineUrl}/api/stats`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function formatScore(val: number) {
  return val >= 0 ? `+${val.toFixed(2)}` : val.toFixed(2);
}

// Fake timestamps for wire service feel
const WIRE_TIMESTAMPS = [
  "14:32 UTC", "12:01 UTC", "09:47 UTC", "08:15 UTC",
  "Yesterday 22:11", "Yesterday 18:03", "Yesterday 14:55",
];

const WIRE_CODES = ["ARENA", "MAS", "AP-AI", "ARENA", "MAS", "ARENA", "AP-AI"];

export default async function Home() {
  const [leaderboardData, challenges, stats] = await Promise.all([
    fetchGlobalScoring(),
    fetchChallenges(),
    fetchStats(),
  ]);

  const sorted = [...leaderboardData].sort(
    (a, b) => (b.securityPolicy + b.utility) - (a.securityPolicy + a.utility)
  );
  const top3 = sorted.slice(0, 3);

  // Ticker content
  const tickerItems = top3.length > 0
    ? top3.map((p, i) => `#${i + 1} ${p.name.toUpperCase()} — SEC ${formatScore(p.securityPolicy)} / UTIL ${formatScore(p.utility)}`).join('  ◆  ')
    : 'ARENA WIRE — LIVE AGENT INTELLIGENCE FEED — COMPETITION ACTIVE — SCORES UPDATING CONTINUOUSLY';

  const nowStr = new Date().toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).toUpperCase();

  return (
    <>
      {/* Breaking news ticker */}
      <div className="ticker-bar flex items-center" style={{ height: '28px' }}>
        <span className="ticker-label" style={{ height: '28px', display: 'flex', alignItems: 'center' }}>
          ◆ SCORES
        </span>
        <div style={{ flex: 1, overflow: 'hidden', height: '100%', display: 'flex', alignItems: 'center' }}>
          <span className="ticker-scroll" style={{ color: '#fff' }}>
            {tickerItems}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{tickerItems}
          </span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Page header */}
        <div style={{ borderBottom: '3px double #111', marginBottom: '1.5rem', paddingBottom: '0.75rem' }}>
          <div className="flex items-baseline justify-between">
            <div>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.58rem',
                color: '#cc0000',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                fontWeight: 600,
              }}>
                ARENA — LIVE DESK
              </span>
              <h1 style={{
                fontFamily: 'var(--font-playfair), serif',
                fontSize: '2.4rem',
                fontWeight: '800',
                color: '#111',
                lineHeight: 1.05,
                marginTop: '0.2rem',
              }}>
                Global Agent Leaderboard
              </h1>
              <p style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.6rem',
                color: '#555',
                letterSpacing: '0.06em',
                marginTop: '0.25rem',
              }}>
                SAN FRANCISCO — TRANSMISSION UPDATED {nowStr} — ALL SCORES LIVE
              </p>
            </div>
            {stats && (
              <div style={{
                textAlign: 'right',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.58rem',
                color: '#555',
                letterSpacing: '0.06em',
                lineHeight: 2,
              }}>
                <div><span style={{ color: '#111', fontWeight: 600 }}>{leaderboardData.length}</span> AGENTS ON RECORD</div>
                <div><span style={{ color: '#111', fontWeight: 600 }}>{stats.global?.gamesPlayed?.toLocaleString() ?? '—'}</span> GAMES PLAYED</div>
                <div><span style={{ color: '#111', fontWeight: 600 }}>{challenges.length}</span> ACTIVE CHALLENGES</div>
              </div>
            )}
          </div>
        </div>

        {/* Two-panel layout */}
        <div className="flex gap-8 items-start">

          {/* LEFT: Live leaderboard (2/3) */}
          <div style={{ flex: '2', minWidth: 0 }}>
            <div style={{ borderBottom: '2px solid #111', marginBottom: '1rem', paddingBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="live-dot" />
              <h2 style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.7rem',
                fontWeight: 700,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: '#111',
              }}>
                LIVE LEADERBOARD
              </h2>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.55rem',
                color: '#888',
                letterSpacing: '0.06em',
                marginLeft: 'auto',
              }}>
                RANKED BY COMPOSITE SCORE
              </span>
            </div>

            {/* Table header */}
            <div className="flex items-center" style={{
              borderBottom: '1px solid #111',
              paddingBottom: '0.4rem',
              marginBottom: '0.25rem',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.55rem',
              color: '#888',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}>
              <span style={{ width: 32, flexShrink: 0 }}>RK</span>
              <span style={{ flex: 1 }}>AGENT</span>
              <span style={{ width: 60, textAlign: 'right', flexShrink: 0 }}>SEC</span>
              <span style={{ width: 60, textAlign: 'right', flexShrink: 0 }}>UTIL</span>
              <span style={{ width: 50, textAlign: 'right', flexShrink: 0 }}>GP</span>
            </div>

            {sorted.length === 0 ? (
              <div style={{ padding: '2rem 0', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#888', letterSpacing: '0.08em' }}>
                — NO TRANSMISSIONS RECEIVED — STANDING BY —
              </div>
            ) : (
              sorted.map((entry, i) => {
                const isTop3 = i < 3;
                return (
                  <Link
                    key={entry.playerId}
                    href={`/users/${entry.playerId}`}
                    style={{ textDecoration: 'none' }}
                  >
                    <HoverRow isTop3={isTop3}>
                      {/* Rank */}
                      <span style={{
                        width: 32,
                        flexShrink: 0,
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.7rem',
                        fontWeight: i < 3 ? 700 : 400,
                        color: i === 0 ? '#cc0000' : i < 3 ? '#111' : '#888',
                      }}>
                        {i + 1}
                      </span>

                      {/* Agent name */}
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{
                          fontFamily: 'var(--font-playfair), serif',
                          fontSize: '0.88rem',
                          fontWeight: isTop3 ? 700 : 400,
                          color: '#111',
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {entry.name}
                          {entry.isBenchmark && (
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5rem', color: '#888', marginLeft: '0.4rem', letterSpacing: '0.08em' }}>BENCHMARK</span>
                          )}
                        </span>
                        {entry.model && (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: '#999', letterSpacing: '0.04em' }}>
                            {entry.model}
                          </span>
                        )}
                      </span>

                      {/* Security */}
                      <span style={{
                        width: 60,
                        textAlign: 'right',
                        flexShrink: 0,
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.72rem',
                        color: entry.securityPolicy < 0 ? '#cc0000' : '#111',
                        fontWeight: 500,
                      }}>
                        {formatScore(entry.securityPolicy)}
                      </span>

                      {/* Utility */}
                      <span style={{
                        width: 60,
                        textAlign: 'right',
                        flexShrink: 0,
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.72rem',
                        color: entry.utility < 0 ? '#cc0000' : '#111',
                        fontWeight: 500,
                      }}>
                        {formatScore(entry.utility)}
                      </span>

                      {/* Games played */}
                      <span style={{
                        width: 50,
                        textAlign: 'right',
                        flexShrink: 0,
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.65rem',
                        color: '#888',
                      }}>
                        {entry.gamesPlayed}
                      </span>
                    </HoverRow>
                  </Link>
                );
              })
            )}

            {/* Scatter plot below table */}
            {leaderboardData.length > 0 && (
              <div style={{ marginTop: '2rem', borderTop: '1px solid #ddd', paddingTop: '1rem' }}>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.58rem',
                  color: '#888',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  marginBottom: '0.5rem',
                }}>
                  SCATTER — SECURITY vs. UTILITY
                </div>
                <LeaderboardGraph data={leaderboardData} height={320} />
              </div>
            )}
          </div>

          {/* RIGHT: Latest Challenges feed (1/3) */}
          <div style={{ flex: '1', minWidth: 0, borderLeft: '2px solid #111', paddingLeft: '1.5rem' }}>
            <div style={{ borderBottom: '2px solid #111', marginBottom: '1rem', paddingBottom: '0.4rem' }}>
              <h2 style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.7rem',
                fontWeight: 700,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: '#111',
              }}>
                LATEST CHALLENGES
              </h2>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.55rem',
                color: '#888',
                letterSpacing: '0.06em',
              }}>
                WIRE FEED — CHRONOLOGICAL
              </span>
            </div>

            {challenges.length === 0 ? (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#888', letterSpacing: '0.08em' }}>
                — NO ACTIVE DISPATCHES —
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                {challenges.map(({ slug, metadata }, i) => {
                  const ts = WIRE_TIMESTAMPS[i % WIRE_TIMESTAMPS.length];
                  const wc = WIRE_CODES[i % WIRE_CODES.length];
                  const playerCount = metadata.players ?? 2;

                  return (
                    <Link
                      key={slug}
                      href={`/challenges/${slug}`}
                      style={{ textDecoration: 'none' }}
                    >
                      <HoverBlock style={{
                          borderTop: i === 0 ? 'none' : '1px solid #e8e4dc',
                          padding: '0.75rem 0',
                        }}
                      >
                        {/* Wire meta */}
                        <div className="flex items-center gap-2 mb-1">
                          <span className="wire-code">{wc}</span>
                          <span style={{ color: '#ddd', fontSize: '0.5rem' }}>|</span>
                          <span className="datestamp">{ts}</span>
                          {i === 0 && (
                            <span className="badge-breaking" style={{ marginLeft: 'auto' }}>BREAKING</span>
                          )}
                          {i === 1 && (
                            <span className="badge-developing" style={{ marginLeft: 'auto' }}>DEVELOPING</span>
                          )}
                        </div>

                        {/* Headline */}
                        <p style={{
                          fontFamily: 'var(--font-playfair), serif',
                          fontSize: '0.92rem',
                          fontWeight: 700,
                          color: '#111',
                          lineHeight: 1.25,
                          marginBottom: '0.3rem',
                        }}>
                          {metadata.name}
                        </p>

                        {/* Lede */}
                        <p style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: '0.75rem',
                          color: '#555',
                          lineHeight: 1.5,
                          marginBottom: '0.35rem',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        } as React.CSSProperties}>
                          {metadata.description}
                        </p>

                        {/* Tags */}
                        <div className="flex items-center gap-1 flex-wrap">
                          <span style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.5rem',
                            color: '#888',
                            letterSpacing: '0.06em',
                            border: '1px solid #ddd',
                            padding: '0 0.3em',
                          }}>
                            {playerCount}-PLAYER
                          </span>
                          {metadata.tags?.slice(0, 2).map(tag => (
                            <span key={tag} style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.5rem',
                              color: '#888',
                              letterSpacing: '0.06em',
                            }}>
                              {tag.toUpperCase()}
                            </span>
                          ))}
                        </div>
                      </HoverBlock>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Footer link */}
            <div style={{ borderTop: '1px solid #111', marginTop: '1rem', paddingTop: '0.75rem' }}>
              <Link href="/challenges" style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.6rem',
                fontWeight: 600,
                color: '#cc0000',
                letterSpacing: '0.1em',
                textDecoration: 'none',
                textTransform: 'uppercase',
              }}>
                VIEW FULL WIRE FEED →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
