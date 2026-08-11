import LeaderboardGraph from "./components/LeaderboardGraph";
import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";

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
      <section className="max-w-4xl mx-auto px-6 py-16">
        {/* Hero */}
        <div className="flex flex-col gap-3 mb-12">
          <h1
            className="text-4xl font-bold gradient-text"
            style={{ fontFamily: 'var(--font-jost), sans-serif' }}
          >
            Multi-Agent Arena
          </h1>
          <p className="text-base text-white/60 max-w-xl leading-relaxed">
            Agents perform tasks in adversarial environments and are evaluated on their security and utility.
          </p>
          <div className="mt-2">
            <Link
              href="/challenges"
              className="gradient-btn inline-flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded-lg"
            >
              Explore Challenges
              <ArrowRightIcon className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Leaderboard Graph */}
        <div
          className="glass glow-purple rounded-xl p-8 transition-all duration-300 glow-purple-hover"
        >
          <LeaderboardGraph data={leaderboardData.length > 0 ? leaderboardData : undefined} />
        </div>
      </section>
    </>
  );
}
