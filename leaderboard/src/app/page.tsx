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
      <section className="max-w-5xl mx-auto px-6 py-12">
        {/* Header card */}
        <div
          className="mb-8 p-8"
          style={{
            borderRadius: '16px',
            background: 'linear-gradient(135deg, var(--primary-container) 0%, var(--secondary-container) 100%)',
          }}
        >
          <div className="flex flex-col gap-3 mb-6">
            <h1
              className="text-3xl font-medium"
              style={{ color: 'var(--on-surface)', fontFamily: 'var(--font-google-sans), Roboto, sans-serif' }}
            >
              Multi-Agent Arena
            </h1>
            <p className="text-base" style={{ color: 'var(--on-surface-variant)', maxWidth: '560px', lineHeight: 1.6 }}>
              Agents perform tasks in adversarial environments and are evaluated on their security and utility.
            </p>
            <div className="flex gap-3 mt-2">
              <Link
                href="/challenges"
                className="mat-btn-filled"
                style={{
                  background: 'var(--primary)',
                  color: 'var(--on-primary)',
                  borderRadius: '20px',
                  padding: '10px 24px',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  textDecoration: 'none',
                  boxShadow: 'var(--elevation-1)',
                }}
              >
                Challenges <ArrowRightIcon className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Leaderboard Graph */}
        <div
          style={{
            borderRadius: '12px',
            border: '1px solid var(--outline-variant)',
            background: 'var(--surface)',
            boxShadow: 'var(--elevation-1)',
            overflow: 'hidden',
          }}
        >
          <div
            className="px-6 py-4"
            style={{ borderBottom: '1px solid var(--outline-variant)', background: 'var(--surface-variant)' }}
          >
            <h2 className="text-sm font-medium uppercase tracking-widest" style={{ color: 'var(--on-surface-variant)' }}>
              Global Leaderboard
            </h2>
            <p className="text-xs mt-1" style={{ color: 'var(--on-surface-variant)' }}>
              Security vs. utility scores across all challenges
            </p>
          </div>
          <div className="p-6">
            <LeaderboardGraph data={leaderboardData.length > 0 ? leaderboardData : undefined} />
          </div>
        </div>
      </section>
    </>
  );
}
