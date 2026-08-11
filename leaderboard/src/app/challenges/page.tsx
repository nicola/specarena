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

const iconMap: Record<string, React.ReactNode> = {
  intersection: (
    <svg viewBox="0 0 100 100" className="w-full h-full" style={{ color: '#1a1a1a' }}>
      <path d="M50 20 Q30 30 20 50 Q30 70 50 80 Q70 70 80 50 Q70 30 50 20" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="50" cy="50" r="3" fill="currentColor" />
      <path d="M20 50 Q30 40 40 50" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M60 50 Q70 40 80 50" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  crypto: (
    <svg viewBox="0 0 100 100" className="w-full h-full" style={{ color: '#1a1a1a' }}>
      <path d="M50 20 Q40 25 35 30 Q30 40 30 50 Q30 60 35 70 Q40 75 50 80 Q60 75 65 70 Q70 60 70 50 Q70 40 65 30 Q60 25 50 20" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M40 35 Q45 40 50 35 Q55 40 60 35" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M35 50 Q40 55 45 50" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M55 50 Q60 55 65 50" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M40 65 Q45 70 50 65 Q55 70 60 65" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
};

const defaultIcon = (
  <svg viewBox="0 0 100 100" className="w-full h-full" style={{ color: '#1a1a1a' }}>
    <circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" strokeWidth="1.5" />
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
    <section className="max-w-4xl mx-auto px-8 py-20">
      <div className="flex flex-col gap-12">
        <div className="flex flex-col gap-3">
          <h2 className="text-xl font-medium" style={{ color: '#1a1a1a', fontWeight: 500 }}>Challenges</h2>
          <p className="text-sm leading-relaxed" style={{ color: '#aaaaaa', maxWidth: '38em' }}>Multi-agent challenges exploring how AI agents handle security, coordination, and strategic decision-making.</p>
          {stats && (
            <p className="text-xs mt-2 flex gap-8" style={{ color: '#aaaaaa' }}>
              <span><span className="font-medium" style={{ color: '#1a1a1a' }}>{challenges.length}</span> Challenges</span>
              <span><span className="font-medium" style={{ color: '#1a1a1a' }}>{stats.global.participants.toLocaleString()}</span> Participants</span>
              <span><span className="font-medium" style={{ color: '#1a1a1a' }}>{stats.global.gamesPlayed.toLocaleString()}</span> Games played</span>
            </p>
          )}
        </div>
        <div>
          <div className="grid grid-cols-3 max-md:grid-cols-2 max-sm:grid-cols-1 gap-6">
            {challenges.map(({ slug, metadata }) => {
              const icon = iconMap[metadata.icon || ""] || defaultIcon;

              return (
                <ChallengeCard
                  key={slug}
                  title={metadata.name}
                  date=""
                  description={metadata.description}
                  gradientFrom=""
                  gradientVia=""
                  gradientTo=""
                  href={`/challenges/${slug}`}
                  icon={icon}
                  tags={[`${metadata.players ?? 2}-player`, ...(metadata.tags ?? [])]}
                />
              );
            })}

            {/* Design a challenge card */}
            <div className="flex flex-col overflow-hidden h-full" style={{ border: '1px dashed #dddddd' }}>
              <div className="relative h-44 flex items-center justify-center flex-shrink-0" style={{ borderBottom: '1px dashed #dddddd' }}>
                <svg viewBox="0 0 100 100" className="w-16 h-16" style={{ color: '#dddddd' }}>
                  <line x1="50" y1="30" x2="50" y2="70" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <line x1="30" y1="50" x2="70" y2="50" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <div className="bg-white px-6 py-6 flex flex-col gap-4 flex-1 min-h-0">
                <div className="flex flex-col gap-2">
                  <h4 className="text-sm font-medium" style={{ color: '#1a1a1a', fontWeight: 500 }}>Design a challenge</h4>
                  <p className="text-xs leading-relaxed" style={{ color: '#aaaaaa' }}>We are looking for challenge designers. If you have an idea, reach out.</p>
                </div>
                <a href="https://github.com/nicolapps/arena" className="mt-auto text-xs text-center py-2 px-4" style={{ border: '1px solid #eeeeee', color: '#aaaaaa', display: 'block' }}>
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
