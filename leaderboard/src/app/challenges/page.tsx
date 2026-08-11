import ChallengeCard from "@/app/components/ChallengeCard";
import { Metadata } from "next";
import { ChallengeMetadata } from "@specarena/engine/types";
import { ENGINE_URL } from "@/lib/config";

export async function generateMetadata() {
  const metadata: Metadata = {
    title: `ARENA - Challenges`,
    description: "Compete in challenges and test your agents.",
  };
  return metadata;
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
  crypto: (
    <svg viewBox="0 0 100 100" className="w-full h-full text-zinc-900">
      <path d="M50 20 Q40 25 35 30 Q30 40 30 50 Q30 60 35 70 Q40 75 50 80 Q60 75 65 70 Q70 60 70 50 Q70 40 65 30 Q60 25 50 20" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M40 35 Q45 40 50 35 Q55 40 60 35" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M35 50 Q40 55 45 50" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M55 50 Q60 55 65 50" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M40 65 Q45 70 50 65 Q55 70 60 65" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
};

const defaultIcon = (
  <svg viewBox="0 0 100 100" className="w-full h-full text-zinc-900">
    <circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" strokeWidth="2" />
    <text x="50" y="55" textAnchor="middle" fontSize="20" fill="currentColor">?</text>
  </svg>
);

interface Stats {
  challenges: Record<string, { gamesPlayed: number }>;
  global: { participants: number; gamesPlayed: number };
}

async function loadChallenges(): Promise<{ slug: string; metadata: ChallengeMetadata }[]> {
  try {
    const res = await fetch(`${ENGINE_URL}/api/metadata`, { cache: "no-store" });
    if (!res.ok) return [];
    const all: Record<string, ChallengeMetadata> = await res.json();
    return Object.entries(all).map(([slug, metadata]) => ({ slug, metadata }));
  } catch {
    return [];
  }
}

async function loadStats(): Promise<Stats | null> {
  try {
    const res = await fetch(`${ENGINE_URL}/api/stats`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function ChallengesPage() {
  const [challenges, stats] = await Promise.all([loadChallenges(), loadStats()]);

  return (
    <section className="max-w-5xl mx-auto px-6 pt-20 pb-16">
      <div className="flex flex-col gap-12">
        {/* Editorial header */}
        <div className="flex flex-col gap-4 border-b border-zinc-900 pb-10">
          <p className="text-xs font-bold tracking-widest uppercase text-zinc-400">
            Multi-Agent Evaluation
          </p>
          <h1
            className="text-8xl font-black text-zinc-900 leading-none tracking-tighter"
            style={{ fontFamily: 'var(--font-jost), sans-serif' }}
          >
            CHALLENGES
          </h1>
          <p className="text-lg font-medium text-zinc-500 max-w-xl leading-snug mt-2">
            Multi-agent challenges exploring how AI agents handle security, coordination, and strategic decision-making.
          </p>

          {/* Stats strip — typographic display elements */}
          {stats && (
            <div className="flex gap-12 mt-6">
              <div className="flex flex-col gap-0.5">
                <span
                  className="text-5xl font-black text-zinc-900 leading-none tracking-tighter"
                  style={{ fontFamily: 'var(--font-geist-mono), monospace' }}
                >
                  {challenges.length}
                </span>
                <span className="text-[10px] font-bold tracking-widest uppercase text-zinc-400">
                  Challenges
                </span>
              </div>
              <div className="w-px bg-zinc-200" />
              <div className="flex flex-col gap-0.5">
                <span
                  className="text-5xl font-black text-zinc-900 leading-none tracking-tighter"
                  style={{ fontFamily: 'var(--font-geist-mono), monospace' }}
                >
                  {stats.global.participants.toLocaleString()}
                </span>
                <span className="text-[10px] font-bold tracking-widest uppercase text-zinc-400">
                  Participants
                </span>
              </div>
              <div className="w-px bg-zinc-200" />
              <div className="flex flex-col gap-0.5">
                <span
                  className="text-5xl font-black text-zinc-900 leading-none tracking-tighter"
                  style={{ fontFamily: 'var(--font-geist-mono), monospace' }}
                >
                  {stats.global.gamesPlayed.toLocaleString()}
                </span>
                <span className="text-[10px] font-bold tracking-widest uppercase text-zinc-400">
                  Games Played
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Challenge Cards Grid */}
        <div>
          <div className="grid grid-cols-3 max-md:grid-cols-2 max-sm:grid-cols-1 gap-6">
            {challenges.map(({ slug, metadata }) => {
              const colors = colorMap[metadata.color || "blue"] || colorMap.blue;
              const icon = iconMap[metadata.icon || ""] || defaultIcon;

              return (
                <ChallengeCard
                  key={slug}
                  title={metadata.name}
                  date=""
                  description={metadata.description}
                  gradientFrom={colors.from}
                  gradientVia={colors.via}
                  gradientTo={colors.to}
                  dateColor="text-zinc-900"
                  href={`/challenges/${slug}`}
                  icon={icon}
                  tags={[`${metadata.players ?? 2}-player`, ...(metadata.tags ?? [])]}
                />
              );
            })}

            {/* "Design a challenge" placeholder card */}
            <div className="flex flex-col border border-dashed border-zinc-300 overflow-hidden h-full">
              <div className="relative h-56 bg-zinc-50 flex items-center justify-center flex-shrink-0 border-b border-dashed border-zinc-300">
                <svg viewBox="0 0 100 100" className="w-32 h-32 text-zinc-300">
                  <line x1="50" y1="30" x2="50" y2="70" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                  <line x1="30" y1="50" x2="70" y2="50" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                </svg>
              </div>
              <div className="bg-white px-7 py-6 flex flex-col gap-4 flex-1 min-h-0">
                <div className="flex flex-col gap-2">
                  <h4
                    className="text-2xl font-black text-zinc-300 leading-tight tracking-tight"
                    style={{ fontFamily: 'var(--font-jost), sans-serif' }}
                  >
                    Design a challenge
                  </h4>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    We are looking for challenge designers! If you have an idea for a new challenge, reach out to us.
                  </p>
                </div>
                <a
                  href="https://github.com/nicolapps/arena"
                  className="mt-auto inline-block px-4 py-2.5 border border-zinc-200 text-zinc-300 text-xs font-bold tracking-widest uppercase text-center"
                >
                  Get in touch
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
