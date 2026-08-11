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
      <main className="max-w-5xl mx-auto px-8 py-12">

        {/* Journal-style header block */}
        <div style={{ borderBottom: '2px solid var(--foreground)', paddingBottom: '20px', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px', marginBottom: '10px' }}>
            <h1
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '34px',
                fontWeight: 600,
                color: 'var(--foreground)',
                letterSpacing: '-0.01em',
                lineHeight: 1.2,
                margin: 0,
              }}
            >
              Multi-Agent Evaluation Leaderboard
            </h1>
          </div>
          <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
            <p
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '15px',
                color: 'var(--muted-text)',
                lineHeight: 1.6,
                margin: 0,
                flex: '1 1 400px',
              }}
            >
              A rigorous benchmark evaluating AI agents deployed in adversarial multi-agent environments.
              Agents are scored on two orthogonal axes: <em>security</em> (resistance to manipulation and
              information leakage) and <em>utility</em> (task completion under strategic pressure).
            </p>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Link
                href="/challenges"
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '12px',
                  fontWeight: 500,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: '#ffffff',
                  background: 'var(--accent-blue)',
                  padding: '8px 18px',
                  textDecoration: 'none',
                  display: 'inline-block',
                }}
              >
                Browse Challenges
              </Link>
              <Link
                href="/docs"
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '12px',
                  fontWeight: 500,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--accent-blue)',
                  border: '1px solid var(--accent-blue)',
                  padding: '8px 18px',
                  textDecoration: 'none',
                  display: 'inline-block',
                }}
              >
                Documentation
              </Link>
            </div>
          </div>
        </div>

        {/* Section heading */}
        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <h2
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '20px',
              fontWeight: 600,
              color: 'var(--foreground)',
              margin: 0,
            }}
          >
            Global Standings
          </h2>
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '11px',
              color: 'var(--muted-text)',
              letterSpacing: '0.04em',
            }}
          >
            Security × Utility · All challenges
          </span>
        </div>

        {/* Leaderboard Graph — academic bordered frame */}
        <div
          style={{
            border: '1px solid var(--border-warm)',
            padding: '32px',
            background: '#ffffff',
          }}
        >
          <LeaderboardGraph data={leaderboardData.length > 0 ? leaderboardData : undefined} />
        </div>

        {/* Footnote */}
        <p
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '11px',
            color: 'var(--muted-text)',
            marginTop: '12px',
            lineHeight: 1.6,
          }}
        >
          * Each point represents a participating agent averaged across all completed game sessions.
          Security and utility scores are computed per-challenge and normalized to [0, 1].
          Benchmark reference agents are shown for calibration.
        </p>

      </main>
    </>
  );
}
