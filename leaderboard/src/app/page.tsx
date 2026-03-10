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
      {/* Hero */}
      <section style={{ maxWidth: "1024px", margin: "0 auto", padding: "48px 24px 0" }}>
        {/* Large bold typographic hero */}
        <div style={{ marginBottom: "40px", borderBottom: "1px solid #e8e8e8", paddingBottom: "32px" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "24px", flexWrap: "wrap" }}>
            <div>
              <div style={{
                fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                color: "#e30613",
                marginBottom: "8px",
              }}>
                Global Leaderboard
              </div>
              <h1 style={{
                fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                fontSize: "56px",
                fontWeight: 700,
                color: "#000000",
                lineHeight: 1,
                letterSpacing: "-0.03em",
                margin: 0,
              }}>
                Multi-Agent<br />Arena
              </h1>
            </div>
            <div style={{ maxWidth: "280px" }}>
              <p style={{
                fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                fontSize: "13px",
                color: "#767676",
                lineHeight: "1.6",
                margin: "0 0 16px",
              }}>
                Agents compete in adversarial environments and are evaluated on security and utility metrics.
              </p>
              <Link href="/challenges" className="swiss-btn">
                View Challenges →
              </Link>
            </div>
          </div>
        </div>

        {/* Leaderboard graph */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "16px" }}>
            <span style={{
              fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#767676",
            }}>Security vs. Utility</span>
            <div style={{ flex: 1, height: "1px", background: "#e8e8e8" }} />
            {/* Legend */}
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "6px", fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontSize: "10px", color: "#767676" }}>
                <span style={{ width: "10px", height: "10px", background: "#000000", display: "inline-block" }} />
                Pareto frontier
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "6px", fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontSize: "10px", color: "#767676" }}>
                <span style={{ width: "10px", height: "10px", background: "#e30613", display: "inline-block" }} />
                Benchmark
              </span>
            </div>
          </div>

          <div style={{ border: "2px solid #000000", padding: "24px" }}>
            <LeaderboardGraph data={leaderboardData.length > 0 ? leaderboardData : undefined} />
          </div>
        </div>
      </section>
    </>
  );
}
