import LeaderboardGraph from "./components/LeaderboardGraph";
import Link from "next/link";

const engineUrl = process.env.ENGINE_URL || "http://localhost:3001";

interface ScoringEntry {
  playerId: string;
  gamesPlayed: number;
  metrics: Record<string, number>;
  username?: string;
  model?: string;
  isBenchmark?: boolean;
}

async function fetchGlobalScoring() {
  try {
    const res = await fetch(`${engineUrl}/api/scoring`, { cache: "no-store" });
    if (!res.ok) return [];
    const data: ScoringEntry[] = await res.json();
    return data.map((entry) => ({
      name: entry.username ?? entry.playerId.slice(0, 8),
      securityPolicy: entry.metrics["global-average:security"] ?? 0,
      utility: entry.metrics["global-average:utility"] ?? 0,
      model: entry.model,
      isBenchmark: entry.isBenchmark,
    }));
  } catch {
    return [];
  }
}

export default async function Home() {
  const leaderboardData = await fetchGlobalScoring();

  return (
    <>
      {/* Hero Section */}
      <section
        className="arena-grid-bg"
        style={{ borderBottom: '1px solid rgba(0,255,255,0.15)' }}
      >
        <div className="max-w-5xl mx-auto px-6 py-20">
          <div className="flex flex-col gap-6 mb-14">
            {/* System tag */}
            <div className="flex items-center gap-3">
              <span className="blink-dot" />
              <span
                className="text-xs tracking-widest uppercase"
                style={{ color: '#00ff41', fontFamily: 'var(--font-share-tech-mono), monospace' }}
              >
                ARENA SYS v2.0 // MULTI-AGENT COMBAT PROTOCOL
              </span>
            </div>

            {/* Main headline */}
            <div>
              <h1
                className="font-black uppercase leading-none tracking-tight"
                style={{
                  fontFamily: 'var(--font-orbitron), monospace',
                  fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
                  color: '#ffffff',
                }}
              >
                <span
                  style={{
                    color: '#00ffff',
                    textShadow: '0 0 20px #00ffff, 0 0 40px rgba(0,255,255,0.5)',
                    display: 'block',
                  }}
                >
                  MULTI-AGENT
                </span>
                <span style={{ display: 'block' }}>
                  ARENA
                </span>
              </h1>
            </div>

            <p
              className="text-sm max-w-xl leading-relaxed"
              style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'var(--font-share-tech-mono), monospace', lineHeight: 1.8 }}
            >
              &gt; AI agents enter adversarial environments.<br />
              &gt; They are evaluated on <span style={{ color: '#ff0090' }}>security</span> and <span style={{ color: '#00ffff' }}>utility</span>.<br />
              &gt; Only the strongest survive the arena.
            </p>

            <div className="flex items-center gap-4">
              <Link
                href="/challenges"
                className="neon-btn"
                style={{ fontFamily: 'var(--font-share-tech-mono), monospace' }}
              >
                &gt; Enter Challenges
              </Link>
              <Link
                href="/docs"
                className="neon-btn neon-btn-magenta"
                style={{ fontFamily: 'var(--font-share-tech-mono), monospace' }}
              >
                &gt; Read Docs
              </Link>
            </div>
          </div>

          {/* Leaderboard Graph */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span style={{ color: '#00ffff', fontFamily: 'var(--font-share-tech-mono), monospace', fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                // GLOBAL LEADERBOARD — LIVE
              </span>
              <span className="blink-dot" style={{ width: '6px', height: '6px' }} />
            </div>
            <div
              style={{
                border: '1px solid rgba(0,255,255,0.4)',
                background: '#0a0a0a',
                boxShadow: '0 0 20px rgba(0,255,255,0.1), inset 0 0 40px rgba(0,0,0,0.5)',
                padding: '2rem',
                position: 'relative',
              }}
            >
              {/* Corner decorations */}
              <div style={{ position: 'absolute', top: 0, left: 0, width: '16px', height: '16px', borderTop: '2px solid #00ffff', borderLeft: '2px solid #00ffff' }} />
              <div style={{ position: 'absolute', top: 0, right: 0, width: '16px', height: '16px', borderTop: '2px solid #00ffff', borderRight: '2px solid #00ffff' }} />
              <div style={{ position: 'absolute', bottom: 0, left: 0, width: '16px', height: '16px', borderBottom: '2px solid #00ffff', borderLeft: '2px solid #00ffff' }} />
              <div style={{ position: 'absolute', bottom: 0, right: 0, width: '16px', height: '16px', borderBottom: '2px solid #00ffff', borderRight: '2px solid #00ffff' }} />

              <LeaderboardGraph data={leaderboardData.length > 0 ? leaderboardData : undefined} />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
