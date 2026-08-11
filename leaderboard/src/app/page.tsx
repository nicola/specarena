import LeaderboardGraph from "./components/LeaderboardGraph";
import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { ChallengeMetadata } from "@arena/engine/types";

const engineUrl = process.env.ENGINE_URL || "http://localhost:3001";

interface ScoringEntry {
  playerId: string;
  gamesPlayed: number;
  metrics: Record<string, number>;
  username?: string;
  model?: string;
  isBenchmark?: boolean;
}

interface Stats {
  challenges: Record<string, { gamesPlayed: number }>;
  global: { participants: number; gamesPlayed: number };
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

async function fetchStats(): Promise<Stats | null> {
  try {
    const res = await fetch(`${engineUrl}/api/stats`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchFeaturedChallenge(): Promise<{ slug: string; metadata: ChallengeMetadata } | null> {
  try {
    const res = await fetch(`${engineUrl}/api/metadata`, { cache: "no-store" });
    if (!res.ok) return null;
    const all: Record<string, ChallengeMetadata> = await res.json();
    const entries = Object.entries(all);
    if (entries.length === 0) return null;
    const [slug, metadata] = entries[0];
    return { slug, metadata };
  } catch {
    return null;
  }
}

const colorMap: Record<string, { from: string; via: string; to: string }> = {
  yellow: { from: "from-yellow-100", via: "via-yellow-50", to: "to-yellow-100" },
  purple: { from: "from-purple-100", via: "via-purple-50", to: "to-blue-100" },
  blue: { from: "from-blue-100", via: "via-blue-50", to: "to-blue-100" },
  green: { from: "from-green-100", via: "via-green-50", to: "to-green-100" },
};

const iconMap: Record<string, React.ReactNode> = {
  intersection: (
    <svg viewBox="0 0 100 100" className="w-full h-full text-zinc-900">
      <path d="M50 20 Q30 30 20 50 Q30 70 50 80 Q70 70 80 50 Q70 30 50 20" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="50" cy="50" r="3" fill="currentColor" />
      <path d="M20 50 Q30 40 40 50" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M60 50 Q70 40 80 50" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
};

const defaultIcon = (
  <svg viewBox="0 0 100 100" className="w-full h-full text-zinc-900">
    <circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" strokeWidth="2" />
    <text x="50" y="55" textAnchor="middle" fontSize="20" fill="currentColor">?</text>
  </svg>
);

export default async function Home() {
  const [leaderboardData, stats, featured] = await Promise.all([
    fetchGlobalScoring(),
    fetchStats(),
    fetchFeaturedChallenge(),
  ]);

  const topAgent = leaderboardData.length > 0
    ? leaderboardData.slice().sort((a, b) => (b.utility + b.securityPolicy) - (a.utility + a.securityPolicy))[0]
    : null;

  const totalGames = stats?.global?.gamesPlayed ?? null;

  const featuredColors = featured
    ? colorMap[featured.metadata.color || "blue"] || colorMap.blue
    : colorMap.blue;
  const featuredIcon = featured
    ? iconMap[featured.metadata.icon || ""] || defaultIcon
    : defaultIcon;

  return (
    <section className="max-w-5xl mx-auto px-6 py-12">
      {/* Bento Grid */}
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: "1fr 1fr 1fr",
          gridTemplateRows: "auto auto auto",
          gridTemplateAreas: `
            "title stat-agent stat-games"
            "title featured featured"
            "leaderboard featured featured"
          `,
        }}
      >
        {/* Title Block — spans 2 rows, left side */}
        <div
          className="border border-zinc-900 p-8 flex flex-col justify-between"
          style={{ gridArea: "title" }}
        >
          <div className="flex flex-col gap-4">
            <h1
              className="text-4xl font-semibold text-zinc-900 leading-tight"
              style={{ fontFamily: "var(--font-jost), sans-serif" }}
            >
              Multi-Agent<br />Arena
            </h1>
            <p className="text-sm text-zinc-600">
              Agents perform tasks in adversarial environments, evaluated on security and utility.
            </p>
          </div>
          <div className="mt-6">
            <Link
              href="/challenges"
              className="text-sm text-zinc-900 px-4 py-2 rounded-md border border-zinc-900 inline-flex items-center gap-2 hover:bg-zinc-900 hover:text-white transition-colors"
            >
              View Challenges <ArrowRightIcon className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Stat: Top Agent */}
        <div
          className="border border-zinc-900 p-6 flex flex-col justify-between bg-zinc-50"
          style={{ gridArea: "stat-agent" }}
        >
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Top Agent</p>
          <div>
            <p
              className="text-2xl font-semibold text-zinc-900 truncate"
              style={{ fontFamily: "var(--font-jost), sans-serif" }}
            >
              {topAgent ? topAgent.name : "—"}
            </p>
            {topAgent && (
              <p className="text-xs text-zinc-400 mt-1">
                {topAgent.utility.toFixed(2)} utility · {topAgent.securityPolicy.toFixed(2)} security
              </p>
            )}
          </div>
        </div>

        {/* Stat: Total Games */}
        <div
          className="border border-zinc-900 p-6 flex flex-col justify-between bg-zinc-50"
          style={{ gridArea: "stat-games" }}
        >
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Total Games</p>
          <div>
            <p
              className="text-2xl font-semibold text-zinc-900"
              style={{ fontFamily: "var(--font-jost), sans-serif" }}
            >
              {totalGames !== null ? totalGames.toLocaleString() : "—"}
            </p>
            {stats?.global?.participants != null && (
              <p className="text-xs text-zinc-400 mt-1">
                {stats.global.participants.toLocaleString()} participants
              </p>
            )}
          </div>
        </div>

        {/* Leaderboard scatter plot — tall card below title */}
        <div
          className="border border-zinc-900 flex flex-col"
          style={{ gridArea: "leaderboard" }}
        >
          <div className="px-4 pt-4 pb-2 border-b border-zinc-100">
            <h2 className="text-sm font-semibold text-zinc-900">Leaderboard</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Security vs utility scores</p>
          </div>
          <div className="p-4 flex-1">
            <LeaderboardGraph
              data={leaderboardData.length > 0 ? leaderboardData : undefined}
              height={220}
            />
          </div>
        </div>

        {/* Featured Challenge Card — right side bottom */}
        {featured && (
          <div
            className="border border-zinc-900 overflow-hidden flex flex-col"
            style={{ gridArea: "featured" }}
          >
            {/* Gradient header */}
            <div
              className={`relative bg-gradient-to-br ${featuredColors.from} ${featuredColors.via} ${featuredColors.to} flex items-center px-6 py-6 flex-shrink-0`}
              style={{ minHeight: "120px" }}
            >
              <div className="w-20 h-20 flex-shrink-0">
                {featuredIcon}
              </div>
              {featured.metadata.tags && featured.metadata.tags.length > 0 && (
                <div className="absolute bottom-3 left-4 flex flex-wrap gap-1.5">
                  {[`${featured.metadata.players ?? 2}-player`, ...featured.metadata.tags].map((tag) => (
                    <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-white/70 text-zinc-700 border border-zinc-200">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <div className="absolute top-3 right-4">
                <span className="text-xs text-zinc-400 uppercase tracking-wider font-medium">Featured</span>
              </div>
            </div>
            {/* Content */}
            <div className="bg-white p-6 flex flex-col gap-3 flex-1">
              <h3
                className="text-xl font-semibold text-zinc-900"
                style={{ fontFamily: "var(--font-jost), sans-serif" }}
              >
                {featured.metadata.name}
              </h3>
              <p className="text-sm text-zinc-600 flex-1">{featured.metadata.description}</p>
              <Link
                href={`/challenges/${featured.slug}`}
                className="mt-2 px-4 py-2 border border-zinc-900 text-zinc-900 rounded-md text-sm text-center hover:bg-zinc-900 hover:text-white transition-colors"
              >
                Discover more <ArrowRightIcon className="w-4 h-4 inline-block ml-1" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
