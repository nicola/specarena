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

        <div className="flex flex-col gap-2 mb-10">
          <h1 className="text-3xl font-semibold text-zinc-900" style={{ fontFamily: 'var(--font-jost), sans-serif' }}>Multi-Agent Arena</h1>
          <p className="text-base text-zinc-900">
            Agents perform tasks in adversarial environments and are evaluated on their security and utility.
          </p>
          <div>
            <Link href="/challenges" className="text-sm text-zinc-900 px-4 py-2 rounded-md border border-zinc-900 inline-block mt-2">
              Challenges <ArrowRightIcon className="w-4 h-4 inline-block ml-2" />
            </Link>
          </div>
        </div>
        {/* Leaderboard Graph */}
        <div className="max-w-4xl mx-auto border border-zinc-900 p-8">
          <LeaderboardGraph data={leaderboardData.length > 0 ? leaderboardData : undefined} />
        </div>
      </section>
    </>
  );
}
