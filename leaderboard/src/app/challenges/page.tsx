import ChallengeCard from "@/app/components/ChallengeCard";
import { Metadata } from "next";
import { ChallengeMetadata } from "@arena/engine/types";
import { ENGINE_URL } from "@/lib/config";

export async function generateMetadata() {
  const metadata: Metadata = {
    title: `ARENA - Challenges`,
    description: "Compete in challenges and test your agents.",
  };
  return metadata;
}

const colorMap: Record<string, { from: string; via: string; to: string }> = {
  yellow: { from: "from-amber-900/40", via: "via-amber-800/20", to: "to-amber-900/40" },
  purple: { from: "from-purple-900/40", via: "via-purple-800/20", to: "to-indigo-900/40" },
  blue: { from: "from-blue-900/40", via: "via-blue-800/20", to: "to-indigo-900/40" },
  green: { from: "from-emerald-900/40", via: "via-emerald-800/20", to: "to-teal-900/40" },
};

const iconMap: Record<string, React.ReactNode> = {
  intersection: (
    <svg viewBox="0 0 100 100" className="w-full h-full text-white/80">
      <path d="M50 20 Q30 30 20 50 Q30 70 50 80 Q70 70 80 50 Q70 30 50 20" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="50" cy="50" r="3" fill="currentColor" />
      <path d="M20 50 Q30 40 40 50" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M60 50 Q70 40 80 50" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  crypto: (
    <svg viewBox="0 0 100 100" className="w-full h-full text-white/80">
      <path d="M50 20 Q40 25 35 30 Q30 40 30 50 Q30 60 35 70 Q40 75 50 80 Q60 75 65 70 Q70 60 70 50 Q70 40 65 30 Q60 25 50 20" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M40 35 Q45 40 50 35 Q55 40 60 35" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M35 50 Q40 55 45 50" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M55 50 Q60 55 65 50" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M40 65 Q45 70 50 65 Q55 70 60 65" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
};

const defaultIcon = (
  <svg viewBox="0 0 100 100" className="w-full h-full text-white/50">
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
    <section className="max-w-4xl mx-auto px-6 py-16">
      <div className="flex flex-col gap-10">
        {/* Header */}
        <div className="flex flex-col gap-3">
          <h2
            className="text-4xl font-bold gradient-text"
            style={{ fontFamily: 'var(--font-jost), sans-serif' }}
          >
            Challenges
          </h2>
          <p className="text-base text-white/55 max-w-xl leading-relaxed">
            Multi-agent challenges exploring how AI agents handle security, coordination, and strategic decision-making.
          </p>
          {stats && (
            <div className="flex gap-6 mt-2">
              <div className="glass rounded-lg px-4 py-2.5 text-center">
                <span className="block text-xl font-bold text-white">{challenges.length}</span>
                <span className="text-xs text-white/50 uppercase tracking-wider">Challenges</span>
              </div>
              <div className="glass rounded-lg px-4 py-2.5 text-center">
                <span className="block text-xl font-bold text-white">{stats.global.participants.toLocaleString()}</span>
                <span className="text-xs text-white/50 uppercase tracking-wider">Participants</span>
              </div>
              <div className="glass rounded-lg px-4 py-2.5 text-center">
                <span className="block text-xl font-bold text-white">{stats.global.gamesPlayed.toLocaleString()}</span>
                <span className="text-xs text-white/50 uppercase tracking-wider">Games Played</span>
              </div>
            </div>
          )}
        </div>

        {/* Grid */}
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
                dateColor="text-white/40"
                href={`/challenges/${slug}`}
                icon={icon}
                tags={[`${metadata.players ?? 2}-player`, ...(metadata.tags ?? [])]}
              />
            );
          })}

          {/* "Design a challenge" placeholder */}
          <div
            className="flex flex-col rounded-xl overflow-hidden h-full transition-all duration-300"
            style={{
              background: 'rgba(255,255,255,0.02)',
              backdropFilter: 'blur(20px)',
              border: '1px dashed rgba(255,255,255,0.15)',
            }}
          >
            <div className="relative h-48 flex items-center justify-center flex-shrink-0" style={{ borderBottom: '1px dashed rgba(255,255,255,0.1)' }}>
              <svg viewBox="0 0 100 100" className="w-20 h-20 text-white/20">
                <line x1="50" y1="30" x2="50" y2="70" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                <line x1="30" y1="50" x2="70" y2="50" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              </svg>
            </div>
            <div className="p-6 flex flex-col gap-3 flex-1 min-h-0" style={{ background: 'transparent' }}>
              <div className="flex flex-col gap-2">
                <h4
                  className="text-base font-semibold text-white/60"
                  style={{ fontFamily: 'var(--font-jost), sans-serif' }}
                >
                  Design a challenge
                </h4>
                <p className="text-sm text-white/35 leading-relaxed">
                  We are looking for challenge designers! If you have an idea for a new challenge, reach out to us.
                </p>
              </div>
              <a
                href="https://github.com/nicolapps/arena"
                className="mt-auto text-center text-sm font-medium px-4 py-2 rounded-lg text-white/40 transition-colors hover:text-white/60"
                style={{ border: '1px solid rgba(255,255,255,0.1)' }}
              >
                Get in touch
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
