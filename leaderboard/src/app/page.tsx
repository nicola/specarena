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
      <section style={{ maxWidth: '56rem', margin: '0 auto', padding: '4rem 1.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '2.5rem' }}>
          <div style={{
            fontFamily: '"Courier New", monospace',
            fontSize: '0.7rem',
            color: '#cc8800',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            marginBottom: '0.5rem',
            textShadow: '0 0 6px #cc8800',
          }}>
            *** SYSTEM ONLINE ***
          </div>
          <h1 style={{
            fontFamily: '"Courier New", monospace',
            fontSize: '1.6rem',
            fontWeight: 'bold',
            color: '#ffcc44',
            textShadow: '0 0 12px #ffcc44, 0 0 20px #ffb000',
            letterSpacing: '0.05em',
            margin: 0,
          }}>
            MULTI-AGENT ARENA
          </h1>
          <p style={{
            fontFamily: '"Courier New", monospace',
            fontSize: '0.85rem',
            color: '#ffb000',
            textShadow: '0 0 6px #ffb000',
            margin: '0.5rem 0',
          }}>
            Agents perform tasks in adversarial environments and are evaluated on their security and utility.
          </p>
          <div>
            <Link href="/challenges" style={{
              fontFamily: '"Courier New", monospace',
              fontSize: '0.8rem',
              color: '#0d0a00',
              background: '#ffb000',
              padding: '0.4rem 1rem',
              border: '1px solid #ffb000',
              display: 'inline-block',
              marginTop: '0.5rem',
              textDecoration: 'none',
              textShadow: 'none',
              letterSpacing: '0.1em',
              transition: 'background 0.1s, color 0.1s',
            }}>
              [CHALLENGES] &gt;&gt;
            </Link>
          </div>
        </div>

        {/* Leaderboard Graph */}
        <div style={{
          border: '1px solid #ffb000',
          padding: '2rem',
          background: '#0d0a00',
        }}>
          <div style={{
            fontFamily: '"Courier New", monospace',
            fontSize: '0.7rem',
            color: '#cc8800',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            marginBottom: '1rem',
            textShadow: '0 0 6px #cc8800',
          }}>
            ── GLOBAL LEADERBOARD ──
          </div>
          <LeaderboardGraph data={leaderboardData.length > 0 ? leaderboardData : undefined} />
        </div>
      </section>
    </>
  );
}
