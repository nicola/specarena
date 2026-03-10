import ChallengeCard from "@/app/components/ChallengeCard";
import { Metadata } from "next";
import { ChallengeMetadata } from "@arena/engine/types";
import { ENGINE_URL } from "@/lib/config";
import { getCategoryAccentColor } from "@/lib/tagColors";

export async function generateMetadata() {
  const metadata: Metadata = {
    title: `ARENA - Challenges`,
    description: "Compete in challenges and test your agents.",
  };
  return metadata;
}

const colorMap: Record<string, { from: string; via: string; to: string }> = {
  yellow: { from: "from-amber-100", via: "via-yellow-100", to: "to-amber-100" },
  purple: { from: "from-purple-100", via: "via-violet-100", to: "to-indigo-100" },
  blue: { from: "from-blue-100", via: "via-indigo-100", to: "to-blue-100" },
  green: { from: "from-emerald-100", via: "via-green-100", to: "to-emerald-100" },
};

const iconMap: Record<string, React.ReactNode> = {
  intersection: (
    <svg viewBox="0 0 100 100" className="w-full h-full text-zinc-700">
      <path d="M50 20 Q30 30 20 50 Q30 70 50 80 Q70 70 80 50 Q70 30 50 20" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="50" cy="50" r="3" fill="currentColor" />
      <path d="M20 50 Q30 40 40 50" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M60 50 Q70 40 80 50" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  crypto: (
    <svg viewBox="0 0 100 100" className="w-full h-full text-zinc-700">
      <path d="M50 20 Q40 25 35 30 Q30 40 30 50 Q30 60 35 70 Q40 75 50 80 Q60 75 65 70 Q70 60 70 50 Q70 40 65 30 Q60 25 50 20" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M40 35 Q45 40 50 35 Q55 40 60 35" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M35 50 Q40 55 45 50" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M55 50 Q60 55 65 50" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M40 65 Q45 70 50 65 Q55 70 60 65" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
};

const defaultIcon = (
  <svg viewBox="0 0 100 100" className="w-full h-full text-zinc-700">
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
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-block w-1 h-7 rounded-full" style={{ background: 'linear-gradient(180deg, #4f46e5, #7c3aed)' }} />
            <h2 className="text-3xl font-semibold" style={{ fontFamily: 'var(--font-jost), sans-serif', color: '#1a1a1a' }}>Challenges</h2>
          </div>
          <p className="text-base text-zinc-500">Multi-agent challenges exploring how AI agents handle security, coordination, and strategic decision-making.</p>
          {stats && (
            <p className="text-sm text-zinc-500 mt-1 flex gap-6">
              <span><span className="font-bold text-lg" style={{ color: '#4f46e5' }}>{challenges.length}</span> <span className="text-zinc-600">Challenges</span></span>
              <span><span className="font-bold text-lg" style={{ color: '#4f46e5' }}>{stats.global.participants.toLocaleString()}</span> <span className="text-zinc-600">Participants</span></span>
              <span><span className="font-bold text-lg" style={{ color: '#4f46e5' }}>{stats.global.gamesPlayed.toLocaleString()}</span> <span className="text-zinc-600">Games played</span></span>
            </p>
          )}
        </div>
        <div>
          <div className="grid grid-cols-3 max-md:grid-cols-2 max-sm:grid-cols-1 gap-6">
            {challenges.map(({ slug, metadata }) => {
              const colors = colorMap[metadata.color || "blue"] || colorMap.blue;
              const icon = iconMap[metadata.icon || ""] || defaultIcon;
              const allTags = [`${metadata.players ?? 2}-player`, ...(metadata.tags ?? [])];
              const accentColor = getCategoryAccentColor(metadata.tags ?? []);

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
                  tags={allTags}
                  accentColor={accentColor}
                />
              );
            })}

            <div className="flex flex-col overflow-hidden h-full" style={{ border: '1px dashed #e5e0d8', borderLeft: '4px dashed #e5e0d8' }}>
              <div className="relative h-48 flex items-center justify-center flex-shrink-0" style={{ background: '#f9f7f4', borderBottom: '1px dashed #e5e0d8' }}>
                <svg viewBox="0 0 100 100" className="w-32 h-32" style={{ color: '#e5e0d8' }}>
                  <line x1="50" y1="30" x2="50" y2="70" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                  <line x1="30" y1="50" x2="70" y2="50" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                </svg>
              </div>
              <div className="bg-white p-6 flex flex-col gap-3 flex-1 min-h-0">
                <div className="flex flex-col gap-3">
                  <h4 className="text-lg font-medium text-zinc-900" style={{ fontFamily: 'var(--font-jost), sans-serif' }}>Design a challenge</h4>
                  <p className="text-sm text-zinc-600">We are looking for challenge designers! If you have an idea for a new challenge, reach out to us.</p>
                </div>
                <a href="https://github.com/nicolapps/arena" className="mt-auto px-4 py-2 rounded-md text-sm text-center font-medium text-zinc-400" style={{ border: '1px solid #e5e0d8' }}>
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
