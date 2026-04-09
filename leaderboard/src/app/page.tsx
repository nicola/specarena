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
      <section className="relative retro-grid-container overflow-hidden" style={{ minHeight: '340px' }}>
        {/* Sunset gradient background */}
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(180deg, #1a0533 0%, #2d0a5e 40%, #5c1080 70%, #8b1a6b 90%, #c2185b 100%)',
        }} />
        {/* Retro grid */}
        <div className="retro-grid" />
        {/* Stars */}
        <div className="absolute inset-0" style={{ overflow: 'hidden' }}>
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                width: i % 3 === 0 ? '3px' : '2px',
                height: i % 3 === 0 ? '3px' : '2px',
                background: i % 2 === 0 ? '#ff006e' : '#00d4ff',
                top: `${(i * 17 + 5) % 60}%`,
                left: `${(i * 23 + 7) % 95}%`,
                opacity: 0.7,
                boxShadow: i % 2 === 0 ? '0 0 6px #ff006e' : '0 0 6px #00d4ff',
              }}
            />
          ))}
        </div>
        {/* Sun/orb */}
        <div className="absolute" style={{
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          background: 'linear-gradient(180deg, #ffd93d 0%, #ff6b6b 50%, #ff006e 100%)',
          bottom: '-20px',
          left: '50%',
          transform: 'translateX(-50%)',
          boxShadow: '0 0 40px #ff6b6b88, 0 0 80px #ff006e44',
          overflow: 'hidden',
        }}>
          {/* Scanlines on sun */}
          {[...Array(8)].map((_, i) => (
            <div key={i} style={{
              position: 'absolute',
              left: 0, right: 0,
              height: '4px',
              background: 'rgba(26, 5, 51, 0.5)',
              top: `${i * 14 + 8}px`,
            }} />
          ))}
        </div>
        {/* Content */}
        <div className="relative z-10 max-w-4xl mx-auto px-6 pt-16 pb-24">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 mb-2">
              <span style={{ color: '#ff006e', fontSize: '0.7rem', fontFamily: 'var(--font-orbitron)', letterSpacing: '0.2em' }}>
                ◆ GLADIATORIAL AI COMBAT ◆
              </span>
            </div>
            <h1
              className="text-5xl font-black leading-none tracking-tight"
              style={{
                fontFamily: 'var(--font-orbitron), sans-serif',
                background: 'linear-gradient(135deg, #ffd93d 0%, #ff6b6b 30%, #ff006e 60%, #8338ec 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                textShadow: 'none',
                filter: 'drop-shadow(0 0 20px rgba(255, 0, 110, 0.4))',
              }}
            >
              MULTI-AGENT<br />ARENA
            </h1>
            <p className="text-base max-w-lg" style={{ color: '#c4a8e0', lineHeight: 1.7 }}>
              AI agents clash in adversarial environments — evaluated on security, utility, and the will to survive.
            </p>
            <div className="flex items-center gap-4 mt-2">
              <Link
                href="/challenges"
                className="neon-btn px-6 py-2.5 text-sm inline-block text-center"
                style={{ fontFamily: 'var(--font-orbitron), sans-serif', fontSize: '0.7rem', letterSpacing: '0.1em' }}
              >
                ENTER ARENA ▶
              </Link>
              <Link
                href="/docs"
                className="neon-btn neon-btn-blue px-6 py-2.5 text-sm inline-block text-center"
                style={{ fontFamily: 'var(--font-orbitron), sans-serif', fontSize: '0.7rem', letterSpacing: '0.1em' }}
              >
                READ DOCS
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Leaderboard Section */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex items-center gap-4 mb-6">
          <h2
            className="text-xl font-bold"
            style={{
              fontFamily: 'var(--font-orbitron), sans-serif',
              background: 'linear-gradient(135deg, #ff006e, #8338ec)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              letterSpacing: '0.1em',
            }}
          >
            LEADERBOARD
          </h2>
          <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, #ff006e44, transparent)' }} />
        </div>
        {/* Graph container */}
        <div
          className="vaporwave-card p-6 relative overflow-hidden"
        >
          {/* Corner decorations */}
          <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2" style={{ borderColor: '#ff006e' }} />
          <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2" style={{ borderColor: '#00d4ff' }} />
          <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2" style={{ borderColor: '#00d4ff' }} />
          <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2" style={{ borderColor: '#ff006e' }} />
          <LeaderboardGraph data={leaderboardData.length > 0 ? leaderboardData : undefined} />
        </div>
      </section>
    </>
  );
}
