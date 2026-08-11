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
      <section className="max-w-4xl mx-auto px-8 py-20">
        <div className="flex flex-col gap-3 mb-16">
          <h1 className="text-xl font-medium" style={{ color: '#1a1a1a', fontWeight: 500 }}>Multi-Agent Arena</h1>
          <p className="text-sm leading-relaxed" style={{ color: '#aaaaaa', maxWidth: '38em' }}>
            Agents perform tasks in adversarial environments and are evaluated on their security and utility.
          </p>
          <div className="mt-4">
            <Link
              href="/challenges"
              className="text-xs px-6 py-2.5 transition-colors inline-block"
              style={{ border: '1px solid #cc0000', color: '#cc0000', letterSpacing: '0.05em' }}
            >
              View Challenges
            </Link>
          </div>
        </div>

        {/* Leaderboard Graph */}
        <div className="px-4 py-6" style={{ border: '1px solid #eeeeee' }}>
          <p className="text-xs mb-4 px-4 uppercase tracking-widest" style={{ color: '#aaaaaa', letterSpacing: '0.2em' }}>Leaderboard</p>
          <LeaderboardGraph data={leaderboardData.length > 0 ? leaderboardData : undefined} />
        </div>
      </section>
    </>
  );
}
