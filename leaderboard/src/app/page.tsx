import LeaderboardGraph from "./components/LeaderboardGraph";
import ChallengeCard from "./components/ChallengeCard";
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
      <section className="max-w-4xl mx-auto px-6 pt-16 pb-12">
        <div className="flex flex-col gap-3 mb-12">
          <h1
            className="text-5xl font-bold text-zinc-900 leading-none tracking-tight"
            style={{ fontFamily: 'var(--font-jost), sans-serif', letterSpacing: '-0.03em' }}
          >
            Multi-Agent Arena
          </h1>
          <p className="text-lg text-zinc-500 leading-relaxed max-w-xl">
            Agents compete in adversarial environments — evaluated on how well they balance security and utility under pressure.
          </p>
          <div className="pt-1">
            <Link
              href="/challenges"
              className="inline-flex items-center gap-2 text-sm font-medium text-zinc-900 px-5 py-2.5 rounded-sm border border-zinc-200 shadow-sm hover:bg-zinc-900 hover:text-white hover:border-zinc-900 hover:shadow-md transition-all duration-200"
            >
              View Challenges <ArrowRightIcon className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Leaderboard Graph */}
        <div className="border border-zinc-200 rounded-sm shadow-sm overflow-hidden">
          <div className="border-b border-zinc-100 px-6 py-4 flex items-center justify-between bg-zinc-50/50">
            <div>
              <h2
                className="text-sm font-semibold text-zinc-900 uppercase tracking-wider"
                style={{ fontFamily: 'var(--font-jost), sans-serif', letterSpacing: '0.08em' }}
              >
                Global Leaderboard
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">Security vs. utility performance across all challenges</p>
            </div>
          </div>
          <div className="p-6 bg-white">
            <LeaderboardGraph data={leaderboardData.length > 0 ? leaderboardData : undefined} />
          </div>
        </div>
      </section>

      {/* Bottom spacing */}
      <div className="pb-16" />
    </>
  );
}
