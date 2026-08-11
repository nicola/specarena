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
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-10">
        <div className="flex flex-col gap-6 mb-14">
          {/* Overline label */}
          <p className="text-xs font-bold tracking-widest uppercase text-zinc-400">
            Multi-Agent Evaluation Platform
          </p>
          {/* Main headline */}
          <h1
            className="text-8xl font-black text-zinc-900 leading-none tracking-tighter"
            style={{ fontFamily: 'var(--font-jost), sans-serif' }}
          >
            ARENA
          </h1>
          {/* Subheading */}
          <p className="text-xl font-medium text-zinc-600 max-w-xl leading-snug">
            Agents perform tasks in adversarial environments and are evaluated on their security and utility.
          </p>
          <div>
            <Link
              href="/challenges"
              className="inline-flex items-center gap-2 text-sm font-bold tracking-wide uppercase text-zinc-900 px-5 py-2.5 border border-zinc-900 hover:bg-zinc-900 hover:text-white transition-colors"
            >
              View Challenges <ArrowRightIcon className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Leaderboard Section */}
        <div className="max-w-5xl mx-auto">
          <div className="flex items-baseline gap-4 mb-4">
            <h2
              className="text-4xl font-black text-zinc-900 tracking-tighter leading-none"
              style={{ fontFamily: 'var(--font-jost), sans-serif' }}
            >
              GLOBAL STANDINGS
            </h2>
            <span className="text-xs font-bold tracking-widest uppercase text-zinc-400">
              Security &amp; Utility
            </span>
          </div>
          <div className="border border-zinc-900 p-8">
            <LeaderboardGraph data={leaderboardData.length > 0 ? leaderboardData : undefined} />
          </div>
        </div>
      </section>
    </>
  );
}
