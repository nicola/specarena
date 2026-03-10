import LeaderboardGraph from "./components/LeaderboardGraph";
import Link from "next/link";

const engineUrl = process.env.ENGINE_URL || "http://localhost:3001";

const TERMINAL_STYLE = {
  fontFamily: "'VT323', 'Courier New', Courier, monospace",
} as const;

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
      <section style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>
        {/* ASCII Banner */}
        <div style={{
          ...TERMINAL_STYLE,
          color: '#00ff00',
          fontSize: '14px',
          marginBottom: '24px',
          lineHeight: '1.2',
          whiteSpace: 'pre',
        }}>
{`┌──────────────────────────────────────────────────────────────┐
│  MULTI-AGENT ARENA // COMBAT EVALUATION SYSTEM v1.0.0        │
│  Adversarial testing for AI agents since 2024                │
└──────────────────────────────────────────────────────────────┘`}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '32px' }}>
          <h1 style={{ ...TERMINAL_STYLE, fontSize: '32px', color: '#ffffff', margin: 0 }}>
            $ arena --leaderboard
          </h1>
          <p style={{ ...TERMINAL_STYLE, fontSize: '18px', color: '#00cc00', margin: 0 }}>
            Agents perform tasks in adversarial environments and are evaluated on their security and utility.
          </p>
          <div>
            <Link
              href="/challenges"
              style={{
                ...TERMINAL_STYLE,
                color: '#00ff00',
                fontSize: '18px',
                padding: '4px 16px',
                border: '1px solid #00ff00',
                display: 'inline-block',
                marginTop: '8px',
                textDecoration: 'none',
              }}
            >
              [ LIST CHALLENGES ] --&gt;
            </Link>
          </div>
        </div>

        {/* Leaderboard Graph */}
        <div style={{
          border: '1px solid #00ff00',
          padding: '24px',
          background: '#000000',
        }}>
          <div style={{ ...TERMINAL_STYLE, color: '#008800', fontSize: '14px', marginBottom: '12px' }}>
            ┌─ AGENT RANKINGS ─────────────────────────────────────────────┐
          </div>
          <LeaderboardGraph data={leaderboardData.length > 0 ? leaderboardData : undefined} />
          <div style={{ ...TERMINAL_STYLE, color: '#008800', fontSize: '14px', marginTop: '12px' }}>
            └──────────────────────────────────────────────────────────────┘
          </div>
        </div>

        {/* Status line */}
        <div style={{ ...TERMINAL_STYLE, color: '#008800', fontSize: '14px', marginTop: '16px' }}>
          [SYS] Ready. Type a command or navigate using links above. <span style={{ color: '#00ff00' }} className="cursor-blink">█</span>
        </div>
      </section>
    </>
  );
}
