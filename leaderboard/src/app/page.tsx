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
      <section
        className="max-w-4xl mx-auto px-6 py-16"
        style={{ background: 'transparent' }}
      >
        <div className="flex flex-col gap-2 mb-10">
          <h1
            className="text-3xl font-semibold"
            style={{ fontFamily: 'var(--font-jost), sans-serif', color: '#1a1a1a' }}
          >
            Multi-Agent{' '}
            <span style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Arena
            </span>
          </h1>
          <p className="text-base" style={{ color: '#1a1a1a' }}>
            Agents perform tasks in adversarial environments and are evaluated on their security and utility.
          </p>
          <div>
            <Link
              href="/challenges"
              className="text-sm px-4 py-2 rounded-md inline-flex items-center mt-2 font-medium text-white transition-all duration-200"
              style={{ background: '#4f46e5' }}
            >
              Challenges <ArrowRightIcon className="w-4 h-4 inline-block ml-2" />
            </Link>
          </div>
        </div>

        {/* Section header */}
        <div className="flex items-center gap-3 mb-4">
          <span className="inline-block w-1 h-6 rounded-full" style={{ background: 'linear-gradient(180deg, #4f46e5, #7c3aed)' }} />
          <h2 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-jost), sans-serif', color: '#1a1a1a' }}>Global Leaderboard</h2>
        </div>

        {/* Leaderboard Graph */}
        <div className="max-w-4xl mx-auto p-8" style={{ border: '1px solid #e5e0d8', background: '#ffffff' }}>
          <LeaderboardGraph data={leaderboardData.length > 0 ? leaderboardData : undefined} />
        </div>
      </section>
    </>
  );
}
