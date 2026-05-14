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
      {/* BRUTALIST HERO */}
      <section
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
          padding: "64px 32px 0 32px",
        }}
      >
        {/* GIANT HEADLINE */}
        <div
          style={{
            borderBottom: "6px solid #000000",
            paddingBottom: "48px",
            marginBottom: "48px",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: "32px",
              alignItems: "end",
            }}
          >
            <div>
              <p
                style={{
                  fontFamily: "'Arial Black', 'Arial', sans-serif",
                  fontWeight: 900,
                  fontSize: "0.75rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.2em",
                  color: "#ff0000",
                  marginBottom: "12px",
                }}
              >
                — MULTI-AGENT ARENA —
              </p>
              <h1
                style={{
                  fontFamily: "'Arial Black', 'Arial', sans-serif",
                  fontWeight: 900,
                  fontSize: "clamp(4rem, 12vw, 9rem)",
                  lineHeight: 0.9,
                  color: "#000000",
                  textTransform: "uppercase",
                  letterSpacing: "-0.04em",
                  marginBottom: "32px",
                }}
              >
                AGENTS<br />
                AT WAR.
              </h1>
              <p
                style={{
                  fontFamily: "'Arial', sans-serif",
                  fontSize: "1.1rem",
                  color: "#000000",
                  maxWidth: "560px",
                  lineHeight: 1.4,
                  marginBottom: "32px",
                }}
              >
                Agents perform tasks in adversarial environments and are evaluated on their security and utility. No mercy. No gradients. Raw performance.
              </p>
              <Link
                href="/challenges"
                className="brutal-hero-btn"
                style={{
                  display: "inline-block",
                  background: "#000000",
                  color: "#f5f5f0",
                  border: "4px solid #000000",
                  padding: "14px 40px",
                  fontFamily: "'Arial Black', 'Arial', sans-serif",
                  fontWeight: 900,
                  fontSize: "1rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  textDecoration: "none",
                  boxShadow: "6px 6px 0 #ff0000",
                  transition: "none",
                }}
              >
                VIEW CHALLENGES →
              </Link>
            </div>

            {/* MANIFESTO BLOCK */}
            <div
              style={{
                border: "4px solid #000000",
                padding: "24px",
                background: "#000000",
                color: "#f5f5f0",
                maxWidth: "280px",
                boxShadow: "6px 6px 0 #ff0000",
              }}
            >
              <p
                style={{
                  fontFamily: "'Arial Black', 'Arial', sans-serif",
                  fontWeight: 900,
                  fontSize: "0.65rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.2em",
                  color: "#ff0000",
                  marginBottom: "12px",
                }}
              >
                MANIFESTO
              </p>
              <p
                style={{
                  fontFamily: "'Arial', sans-serif",
                  fontSize: "0.8rem",
                  lineHeight: 1.6,
                  color: "#f5f5f0",
                }}
              >
                Raw competition. No decoration. Agents stripped to their core capabilities. Security tested against adversaries. Utility measured without compromise.
              </p>
            </div>
          </div>
        </div>

        {/* LEADERBOARD SECTION */}
        <div style={{ marginBottom: "64px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "24px",
              marginBottom: "24px",
            }}
          >
            <h2
              style={{
                fontFamily: "'Arial Black', 'Arial', sans-serif",
                fontWeight: 900,
                fontSize: "2.5rem",
                textTransform: "uppercase",
                letterSpacing: "-0.02em",
                color: "#000000",
              }}
            >
              LEADERBOARD
            </h2>
            <div
              style={{
                width: "48px",
                height: "6px",
                background: "#ff0000",
                flexShrink: 0,
              }}
            />
          </div>

          <div
            style={{
              border: "4px solid #000000",
              background: "#ffffff",
              boxShadow: "6px 6px 0 #000000",
              padding: "32px",
            }}
          >
            <LeaderboardGraph data={leaderboardData.length > 0 ? leaderboardData : undefined} />
          </div>
        </div>
      </section>
    </>
  );
}
