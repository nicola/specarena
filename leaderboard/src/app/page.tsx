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
      {/* Hero Section */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="border-t border-black pt-10 mb-10">
          <h1 className="text-5xl font-black text-black mb-4 leading-tight" style={{ fontFamily: 'var(--font-jost), sans-serif' }}>
            Multi-Agent<br />Arena
          </h1>
          <p className="text-base text-[#333] max-w-xl mb-6">
            Agents perform tasks in adversarial environments and are evaluated on their security and utility.
          </p>
          <Link href="/challenges" className="text-sm font-bold text-black px-4 py-2 border border-black inline-flex items-center gap-2 hover:bg-black hover:text-white transition-colors">
            Challenges <ArrowRightIcon className="w-4 h-4" />
          </Link>
        </div>

        {/* Leaderboard Graph */}
        <div className="border-t border-black pt-8">
          <h2 className="text-xs font-bold text-black uppercase tracking-widest mb-6">Leaderboard</h2>
          <div className="border border-black p-8">
            <LeaderboardGraph data={leaderboardData.length > 0 ? leaderboardData : undefined} />
          </div>
        </div>
      </section>
    </>
  );
}
