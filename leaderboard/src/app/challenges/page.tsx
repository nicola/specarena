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

const iconMap: Record<string, React.ReactNode> = {
  intersection: (
    <svg viewBox="0 0 100 100" className="w-full h-full" style={{ color: '#1a1008' }}>
      <path d="M50 20 Q30 30 20 50 Q30 70 50 80 Q70 70 80 50 Q70 30 50 20" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="50" cy="50" r="3" fill="currentColor" />
      <path d="M20 50 Q30 40 40 50" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M60 50 Q70 40 80 50" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  crypto: (
    <svg viewBox="0 0 100 100" className="w-full h-full" style={{ color: '#1a1008' }}>
      <path d="M50 20 Q40 25 35 30 Q30 40 30 50 Q30 60 35 70 Q40 75 50 80 Q60 75 65 70 Q70 60 70 50 Q70 40 65 30 Q60 25 50 20" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M40 35 Q45 40 50 35 Q55 40 60 35" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M35 50 Q40 55 45 50" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M55 50 Q60 55 65 50" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M40 65 Q45 70 50 65 Q55 70 60 65" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
};

const defaultIcon = (
  <svg viewBox="0 0 100 100" className="w-full h-full" style={{ color: '#1a1008' }}>
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
          {/* Decorative header element */}
          <div className="flex items-center gap-3 mb-2">
            <div
              style={{
                width: 28,
                height: 28,
                border: '1.5px solid #cc2200',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <span style={{ color: '#cc2200', fontSize: 11, fontFamily: 'var(--font-noto-serif)', fontWeight: 700 }}>戰</span>
            </div>
            <div style={{ height: 1, flex: 1, background: 'linear-gradient(to right, #cc2200, transparent)', opacity: 0.4 }} />
          </div>

          <h2
            className="text-4xl font-semibold"
            style={{
              fontFamily: 'var(--font-noto-serif), serif',
              color: '#1a1008',
              letterSpacing: '0.04em',
            }}
          >
            Challenges
          </h2>
          <p className="text-base" style={{ color: '#8b4513', lineHeight: 1.7 }}>
            Multi-agent challenges exploring how AI agents handle security, coordination, and strategic decision-making.
          </p>
          {stats && (
            <p
              className="text-sm mt-2 flex gap-6"
              style={{ color: '#8b4513', fontFamily: 'var(--font-noto-sans)' }}
            >
              <span>
                <span style={{ fontWeight: 600, color: '#1a1008' }}>{challenges.length}</span> Challenges
              </span>
              <span>
                <span style={{ fontWeight: 600, color: '#1a1008' }}>{stats.global.participants.toLocaleString()}</span> Participants
              </span>
              <span>
                <span style={{ fontWeight: 600, color: '#1a1008' }}>{stats.global.gamesPlayed.toLocaleString()}</span> Games played
              </span>
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
                  dateColor=""
                  href={`/challenges/${slug}`}
                  icon={icon}
                  tags={[`${metadata.players ?? 2}-player`, ...(metadata.tags ?? [])]}
                />
              );
            })}

            {/* "Design a challenge" placeholder card */}
            <div
              className="flex flex-col overflow-hidden h-full"
              style={{
                border: '1px dashed #b8997a',
                background: '#faf6ef',
              }}
            >
              <div
                className="relative flex items-center justify-center flex-shrink-0"
                style={{
                  height: '12rem',
                  background: '#f5efe5',
                  borderBottom: '1px dashed #b8997a',
                }}
              >
                <svg viewBox="0 0 100 100" className="w-32 h-32" style={{ color: '#d4c4a8' }}>
                  <line x1="50" y1="30" x2="50" y2="70" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  <line x1="30" y1="50" x2="70" y2="50" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </div>
              <div className="p-6 flex flex-col gap-3 flex-1 min-h-0" style={{ background: '#faf6ef' }}>
                <div className="flex flex-col gap-3">
                  <div style={{ width: 32, height: 2, background: '#b8997a', opacity: 0.5 }} />
                  <h4
                    className="text-lg font-semibold"
                    style={{
                      fontFamily: 'var(--font-noto-serif), serif',
                      color: '#8b4513',
                    }}
                  >
                    Design a challenge
                  </h4>
                  <p className="text-sm" style={{ color: '#b8997a', lineHeight: 1.6 }}>
                    We are looking for challenge designers! If you have an idea for a new challenge, reach out to us.
                  </p>
                </div>
                <a
                  href="https://github.com/nicolapps/arena"
                  className="mt-auto text-sm text-center transition-colors"
                  style={{
                    display: 'block',
                    padding: '8px 16px',
                    border: '1px dashed #b8997a',
                    color: '#b8997a',
                    textDecoration: 'none',
                    fontFamily: 'var(--font-noto-sans)',
                    letterSpacing: '0.04em',
                  }}
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
