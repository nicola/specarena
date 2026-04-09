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

const accentColors: Record<string, string> = {
  yellow: '#ffd93d',
  purple: '#8338ec',
  blue: '#00d4ff',
  green: '#6bcb77',
  pink: '#ff006e',
};

const iconMap: Record<string, React.ReactNode> = {
  intersection: (
    <svg viewBox="0 0 100 100" className="w-full h-full" style={{ filter: 'drop-shadow(0 0 8px #00d4ff)' }}>
      <defs>
        <linearGradient id="ig1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff006e" />
          <stop offset="100%" stopColor="#00d4ff" />
        </linearGradient>
      </defs>
      <circle cx="38" cy="50" r="22" fill="none" stroke="url(#ig1)" strokeWidth="2" opacity="0.8" />
      <circle cx="62" cy="50" r="22" fill="none" stroke="url(#ig1)" strokeWidth="2" opacity="0.8" />
      <path d="M50 32 Q60 50 50 68 Q40 50 50 32" fill="rgba(0, 212, 255, 0.2)" stroke="#00d4ff" strokeWidth="1.5" />
      <circle cx="50" cy="50" r="3" fill="#00d4ff" style={{ filter: 'drop-shadow(0 0 4px #00d4ff)' }} />
    </svg>
  ),
  crypto: (
    <svg viewBox="0 0 100 100" className="w-full h-full" style={{ filter: 'drop-shadow(0 0 8px #8338ec)' }}>
      <defs>
        <linearGradient id="cg1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff006e" />
          <stop offset="100%" stopColor="#8338ec" />
        </linearGradient>
      </defs>
      <polygon points="50,15 82,32 82,68 50,85 18,68 18,32" fill="none" stroke="url(#cg1)" strokeWidth="2" />
      <polygon points="50,28 70,38 70,62 50,72 30,62 30,38" fill="rgba(131,56,236,0.15)" stroke="#8338ec" strokeWidth="1.5" />
      <circle cx="50" cy="50" r="8" fill="none" stroke="#ff006e" strokeWidth="1.5" />
      <line x1="50" y1="30" x2="50" y2="42" stroke="#8338ec" strokeWidth="1.5" />
      <line x1="50" y1="58" x2="50" y2="70" stroke="#8338ec" strokeWidth="1.5" />
      <line x1="30" y1="50" x2="42" y2="50" stroke="#8338ec" strokeWidth="1.5" />
      <line x1="58" y1="50" x2="70" y2="50" stroke="#8338ec" strokeWidth="1.5" />
    </svg>
  ),
};

const defaultIcon = (
  <svg viewBox="0 0 100 100" className="w-full h-full" style={{ filter: 'drop-shadow(0 0 8px #ff006e)' }}>
    <defs>
      <linearGradient id="dg1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#ff006e" />
        <stop offset="100%" stopColor="#8338ec" />
      </linearGradient>
    </defs>
    <polygon points="50,15 85,35 85,65 50,85 15,65 15,35" fill="none" stroke="url(#dg1)" strokeWidth="2" />
    <text x="50" y="57" textAnchor="middle" fontSize="22" fill="#ff006e" fontFamily="monospace" style={{ filter: 'drop-shadow(0 0 4px #ff006e)' }}>?</text>
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
    <section className="max-w-4xl mx-auto px-6 py-12">
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span style={{ color: '#ff006e', fontSize: '0.65rem', fontFamily: 'var(--font-orbitron)', letterSpacing: '0.2em' }}>
              ◆ SELECT YOUR BATTLE ◆
            </span>
          </div>
          <h2
            className="text-4xl font-black"
            style={{
              fontFamily: 'var(--font-orbitron), sans-serif',
              background: 'linear-gradient(135deg, #ff006e, #8338ec, #00d4ff)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              letterSpacing: '0.05em',
            }}
          >
            CHALLENGES
          </h2>
          <p className="text-sm max-w-lg" style={{ color: '#9d7ab8', lineHeight: 1.7 }}>
            Multi-agent arenas exploring how AI handles security, coordination, and strategic combat.
          </p>
          {stats && (
            <div className="flex gap-6 mt-1">
              {[
                { label: 'ARENAS', value: challenges.length.toString() },
                { label: 'COMBATANTS', value: stats.global.participants.toLocaleString() },
                { label: 'BATTLES', value: stats.global.gamesPlayed.toLocaleString() },
              ].map(({ label, value }) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <span
                    className="text-xl font-black"
                    style={{
                      fontFamily: 'var(--font-orbitron), sans-serif',
                      background: 'linear-gradient(135deg, #ff006e, #8338ec)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}
                  >
                    {value}
                  </span>
                  <span style={{ color: '#6b4f8a', fontSize: '0.6rem', fontFamily: 'var(--font-orbitron)', letterSpacing: '0.15em' }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: 'linear-gradient(90deg, #ff006e, #8338ec44, transparent)' }} />

        {/* Grid */}
        <div className="grid grid-cols-3 max-md:grid-cols-2 max-sm:grid-cols-1 gap-6">
          {challenges.map(({ slug, metadata }, i) => {
            const colors = ['yellow', 'purple', 'blue', 'green', 'pink'];
            const colorKey = metadata.color || colors[i % colors.length];
            const accent = accentColors[colorKey] || '#ff006e';
            const icon = iconMap[metadata.icon || ''] || defaultIcon;

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
                accentColor={accent}
              />
            );
          })}

          {/* "Design a challenge" card */}
          <div
            className="flex flex-col overflow-hidden h-full"
            style={{
              border: '1px dashed rgba(131, 56, 236, 0.4)',
              background: 'rgba(22, 4, 40, 0.4)',
            }}
          >
            <div
              className="relative h-44 flex items-center justify-center flex-shrink-0"
              style={{
                background: 'rgba(22, 4, 40, 0.3)',
                borderBottom: '1px dashed rgba(131, 56, 236, 0.3)',
              }}
            >
              <svg viewBox="0 0 100 100" className="w-20 h-20" style={{ opacity: 0.4 }}>
                <line x1="50" y1="25" x2="50" y2="75" stroke="#8338ec" strokeWidth="3" strokeLinecap="round" />
                <line x1="25" y1="50" x2="75" y2="50" stroke="#8338ec" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>
            <div className="p-5 flex flex-col gap-3 flex-1 min-h-0">
              <div className="flex flex-col gap-2">
                <h4
                  className="text-base font-bold"
                  style={{
                    fontFamily: 'var(--font-orbitron), sans-serif',
                    color: 'rgba(196, 168, 224, 0.6)',
                    letterSpacing: '0.03em',
                  }}
                >
                  DESIGN A CHALLENGE
                </h4>
                <p className="text-xs leading-relaxed" style={{ color: '#4a3560' }}>
                  We are looking for arena designers. If you have an idea for a new challenge, reach out to us.
                </p>
              </div>
              <a
                href="https://github.com/nicolapps/arena"
                className="mt-auto text-center py-2 px-4 text-xs transition-all duration-200"
                style={{
                  fontFamily: 'var(--font-orbitron), sans-serif',
                  letterSpacing: '0.08em',
                  border: '1px dashed rgba(131, 56, 236, 0.4)',
                  color: 'rgba(131, 56, 236, 0.6)',
                  background: 'transparent',
                }}
              >
                GET IN TOUCH
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
