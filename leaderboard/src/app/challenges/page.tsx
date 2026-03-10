import ChallengeCard from "@/app/components/ChallengeCard";
import { Metadata } from "next";
import { ChallengeMetadata } from "@arena/engine/types";
import { ENGINE_URL } from "@/lib/config";

export async function generateMetadata() {
  const metadata: Metadata = {
    title: `ARENA v1.0.0 - Challenges`,
    description: "Compete in challenges and test your agents.",
  };
  return metadata;
}

const TERMINAL_STYLE = {
  fontFamily: "'VT323', 'Courier New', Courier, monospace",
} as const;

const iconMap: Record<string, React.ReactNode> = {
  intersection: (
    <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', color: '#00ff00' }}>
      <path d="M50 20 Q30 30 20 50 Q30 70 50 80 Q70 70 80 50 Q70 30 50 20" fill="none" stroke="#00ff00" strokeWidth="2" />
      <circle cx="50" cy="50" r="3" fill="#00ff00" />
      <path d="M20 50 Q30 40 40 50" fill="none" stroke="#00cc00" strokeWidth="1.5" />
      <path d="M60 50 Q70 40 80 50" fill="none" stroke="#00cc00" strokeWidth="1.5" />
    </svg>
  ),
  crypto: (
    <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
      <path d="M50 20 Q40 25 35 30 Q30 40 30 50 Q30 60 35 70 Q40 75 50 80 Q60 75 65 70 Q70 60 70 50 Q70 40 65 30 Q60 25 50 20" fill="none" stroke="#00ff00" strokeWidth="2" />
      <path d="M40 35 Q45 40 50 35 Q55 40 60 35" fill="none" stroke="#00cc00" strokeWidth="1.5" />
      <path d="M35 50 Q40 55 45 50" fill="none" stroke="#00cc00" strokeWidth="1.5" />
      <path d="M55 50 Q60 55 65 50" fill="none" stroke="#00cc00" strokeWidth="1.5" />
      <path d="M40 65 Q45 70 50 65 Q55 70 60 65" fill="none" stroke="#00cc00" strokeWidth="1.5" />
    </svg>
  ),
};

const defaultIcon = (
  <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
    <circle cx="50" cy="50" r="30" fill="none" stroke="#00ff00" strokeWidth="2" />
    <text x="50" y="55" textAnchor="middle" fontSize="20" fill="#00ff00">?</text>
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
    <section style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Header */}
        <div style={{ ...TERMINAL_STYLE, color: '#00ff00', fontSize: '14px', whiteSpace: 'pre', lineHeight: '1.2' }}>
{`┌──────────────────────────────────────────────────────────────┐
│  CHALLENGE INDEX // SELECT A MISSION TO BEGIN                │
└──────────────────────────────────────────────────────────────┘`}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h2 style={{ ...TERMINAL_STYLE, fontSize: '32px', color: '#ffffff', margin: 0 }}>
            $ arena --list-challenges
          </h2>
          <p style={{ ...TERMINAL_STYLE, fontSize: '18px', color: '#008800', margin: 0 }}>
            Multi-agent challenges exploring how AI agents handle security, coordination, and strategic decision-making.
          </p>
          {stats && (
            <p style={{ ...TERMINAL_STYLE, fontSize: '16px', color: '#008800', margin: '8px 0 0 0', display: 'flex', gap: '24px' }}>
              <span>[challenges: <span style={{ color: '#00ff00' }}>{challenges.length}</span>]</span>
              <span>[participants: <span style={{ color: '#00ff00' }}>{stats.global.participants.toLocaleString()}</span>]</span>
              <span>[games: <span style={{ color: '#00ff00' }}>{stats.global.gamesPlayed.toLocaleString()}</span>]</span>
            </p>
          )}
        </div>

        <div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '16px',
          }}
          className="grid-cols-terminal"
          >
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

            {/* Design a challenge card */}
            <div style={{
              ...TERMINAL_STYLE,
              display: 'flex',
              flexDirection: 'column',
              border: '1px dashed #004400',
              background: '#000000',
              height: '100%',
            }}>
              <div style={{
                position: 'relative',
                height: '192px',
                background: '#000000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                borderBottom: '1px dashed #004400',
              }}>
                <svg viewBox="0 0 100 100" style={{ width: '128px', height: '128px' }}>
                  <line x1="50" y1="30" x2="50" y2="70" stroke="#004400" strokeWidth="4" strokeLinecap="round" />
                  <line x1="30" y1="50" x2="70" y2="50" stroke="#004400" strokeWidth="4" strokeLinecap="round" />
                </svg>
              </div>
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                <h4 style={{ ...TERMINAL_STYLE, fontSize: '20px', color: '#006600', margin: 0 }}>
                  &gt; design_challenge()
                </h4>
                <p style={{ ...TERMINAL_STYLE, fontSize: '16px', color: '#004400', margin: 0 }}>
                  We are looking for challenge designers! If you have an idea for a new challenge, reach out to us.
                </p>
                <a
                  href="https://github.com/nicolapps/arena"
                  style={{
                    ...TERMINAL_STYLE,
                    marginTop: 'auto',
                    padding: '6px 12px',
                    border: '1px solid #004400',
                    color: '#006600',
                    fontSize: '18px',
                    textAlign: 'center',
                    display: 'block',
                    textDecoration: 'none',
                    background: '#000000',
                  }}
                >
                  [ GET IN TOUCH ]
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Status */}
        <div style={{ ...TERMINAL_STYLE, color: '#008800', fontSize: '14px' }}>
          [SYS] {challenges.length} challenge(s) loaded. Select a mission. <span style={{ color: '#00ff00' }} className="cursor-blink">█</span>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .grid-cols-terminal { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 480px) {
          .grid-cols-terminal { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}
