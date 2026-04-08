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
    <svg viewBox="0 0 100 100" className="w-full h-full" style={{ color: '#495057' }}>
      <path d="M50 20 Q30 30 20 50 Q30 70 50 80 Q70 70 80 50 Q70 30 50 20" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="50" cy="50" r="3" fill="currentColor" />
      <path d="M20 50 Q30 40 40 50" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M60 50 Q70 40 80 50" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  crypto: (
    <svg viewBox="0 0 100 100" className="w-full h-full" style={{ color: '#495057' }}>
      <path d="M50 20 Q40 25 35 30 Q30 40 30 50 Q30 60 35 70 Q40 75 50 80 Q60 75 65 70 Q70 60 70 50 Q70 40 65 30 Q60 25 50 20" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M40 35 Q45 40 50 35 Q55 40 60 35" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M35 50 Q40 55 45 50" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M55 50 Q60 55 65 50" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M40 65 Q45 70 50 65 Q55 70 60 65" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
};

const defaultIcon = (
  <svg viewBox="0 0 100 100" className="w-full h-full" style={{ color: '#adb5bd' }}>
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
    <section className="max-w-7xl mx-auto px-4 py-6">
      {/* Header row */}
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <h2 className="font-semibold mb-0.5" style={{ color: '#212529', fontSize: '18px' }}>Challenges</h2>
          <p style={{ color: '#6c757d', fontSize: '12px' }}>Multi-agent challenges: security, coordination, and strategic decision-making.</p>
        </div>
        {stats && (
          <div className="flex gap-4" style={{ fontSize: '12px', color: '#6c757d' }}>
            <span><span className="font-semibold" style={{ color: '#212529' }}>{challenges.length}</span> challenges</span>
            <span><span className="font-semibold" style={{ color: '#212529' }}>{stats.global.participants.toLocaleString()}</span> participants</span>
            <span><span className="font-semibold" style={{ color: '#212529' }}>{stats.global.gamesPlayed.toLocaleString()}</span> games</span>
          </div>
        )}
      </div>

      {/* Challenge grid — 4 columns on large, 3 on md, 2 on sm, 1 on xs */}
      <div className="grid grid-cols-4 max-lg:grid-cols-3 max-md:grid-cols-2 max-sm:grid-cols-1 gap-3">
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

        {/* Design a challenge card */}
        <div className="flex flex-col overflow-hidden h-full" style={{ border: '1px dashed #dee2e6', background: '#fff' }}>
          <div className="relative h-28 flex items-center justify-center flex-shrink-0" style={{ background: '#f8f9fa', borderBottom: '1px dashed #dee2e6' }}>
            <svg viewBox="0 0 100 100" className="w-16 h-16" style={{ color: '#dee2e6' }}>
              <line x1="50" y1="30" x2="50" y2="70" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              <line x1="30" y1="50" x2="70" y2="50" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
            </svg>
          </div>
          <div className="px-3 py-2 flex flex-col gap-1.5 flex-1 min-h-0">
            <h4 className="font-semibold" style={{ color: '#6c757d', fontSize: '13px' }}>Design a challenge</h4>
            <p style={{ color: '#adb5bd', fontSize: '12px' }}>Have an idea for a new challenge? Reach out to us.</p>
            <a href="https://github.com/nicolapps/arena" className="mt-auto px-2 py-1 text-center rounded font-medium" style={{ border: '1px solid #dee2e6', color: '#adb5bd', fontSize: '12px', textDecoration: 'none' }}>
              Get in touch
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
