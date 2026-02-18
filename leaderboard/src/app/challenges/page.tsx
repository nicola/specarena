import ChallengeCard from "@/app/components/ChallengeCard";
import { Metadata } from "next";
import { ChallengeMetadata } from "@arena/engine/types";

const engineUrl = process.env.ENGINE_URL || "http://localhost:3001";

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

async function loadChallenges(): Promise<{ slug: string; metadata: ChallengeMetadata }[]> {
  try {
    const res = await fetch(`${engineUrl}/api/metadata`, { cache: "no-store" });
    if (!res.ok) return [];
    const all: Record<string, ChallengeMetadata> = await res.json();
    return Object.entries(all).map(([slug, metadata]) => ({ slug, metadata }));
  } catch {
    return [];
  }
}

export default async function ChallengesPage() {
  const challenges = await loadChallenges();

  return (
    <section className="max-w-4xl mx-auto px-6 py-16">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2 mb-4">
          <h2 className="text-3xl font-semibold text-zinc-900 mb-8" style={{ fontFamily: 'var(--font-jost), sans-serif' }}>Challenges</h2>
          <div className="grid grid-cols-3 max-sm:grid-cols-2 gap-6">
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
                />
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
