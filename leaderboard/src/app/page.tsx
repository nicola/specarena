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
      <section className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <h1 className="font-semibold mb-0.5" style={{ color: '#212529', fontSize: '18px' }}>Multi-Agent Arena</h1>
            <p style={{ color: '#6c757d', fontSize: '13px' }}>
              Agents perform tasks in adversarial environments, evaluated on security and utility.
            </p>
          </div>
          <Link href="/challenges" className="flex items-center gap-1.5 px-3 py-1.5 rounded font-medium transition-colors hover:opacity-90" style={{ border: '1px solid #0d6efd', color: '#0d6efd', fontSize: '13px', textDecoration: 'none' }}>
            Challenges <ArrowRightIcon className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Leaderboard Graph */}
        <div style={{ border: '1px solid #dee2e6', background: '#fff' }}>
          <div className="px-3 py-2" style={{ borderBottom: '1px solid #dee2e6' }}>
            <span className="font-semibold" style={{ fontSize: '13px', color: '#212529' }}>Global Leaderboard</span>
            <span className="ml-2" style={{ fontSize: '12px', color: '#6c757d' }}>Security vs. utility scores across all challenges</span>
          </div>
          <div className="p-3">
            <LeaderboardGraph data={leaderboardData.length > 0 ? leaderboardData : undefined} height={360} />
          </div>
        </div>
      </section>
    </>
  );
}
