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
    <svg viewBox="0 0 100 100" className="w-full h-full" style={{ color: '#ffb000' }}>
      <path d="M50 20 Q30 30 20 50 Q30 70 50 80 Q70 70 80 50 Q70 30 50 20" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="50" cy="50" r="3" fill="currentColor" />
      <path d="M20 50 Q30 40 40 50" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M60 50 Q70 40 80 50" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  crypto: (
    <svg viewBox="0 0 100 100" className="w-full h-full" style={{ color: '#ffb000' }}>
      <path d="M50 20 Q40 25 35 30 Q30 40 30 50 Q30 60 35 70 Q40 75 50 80 Q60 75 65 70 Q70 60 70 50 Q70 40 65 30 Q60 25 50 20" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M40 35 Q45 40 50 35 Q55 40 60 35" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M35 50 Q40 55 45 50" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M55 50 Q60 55 65 50" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M40 65 Q45 70 50 65 Q55 70 60 65" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
};

const defaultIcon = (
  <svg viewBox="0 0 100 100" className="w-full h-full" style={{ color: '#ffb000' }}>
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

const amber = '#ffb000';
const amberDim = '#cc8800';
const amberBright = '#ffcc44';
const bg = '#0d0a00';

export default async function ChallengesPage() {
  const [challenges, stats] = await Promise.all([loadChallenges(), loadStats()]);

  return (
    <section style={{ maxWidth: '56rem', margin: '0 auto', padding: '4rem 1.5rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <h2 style={{
            fontFamily: '"Courier New", monospace',
            fontSize: '1.6rem',
            fontWeight: 'bold',
            color: amberBright,
            textShadow: `0 0 12px ${amberBright}, 0 0 20px ${amber}`,
            letterSpacing: '0.05em',
            margin: 0,
          }}>
            CHALLENGES
          </h2>
          <p style={{
            fontFamily: '"Courier New", monospace',
            fontSize: '0.82rem',
            color: amberDim,
            textShadow: `0 0 6px ${amberDim}`,
            margin: 0,
          }}>
            Multi-agent challenges exploring how AI agents handle security, coordination, and strategic decision-making.
          </p>
          {stats && (
            <p style={{
              fontFamily: '"Courier New", monospace',
              fontSize: '0.78rem',
              color: amberDim,
              textShadow: `0 0 4px ${amberDim}`,
              marginTop: '0.5rem',
              display: 'flex',
              gap: '1.5rem',
            }}>
              <span><span style={{ color: amber, textShadow: `0 0 6px ${amber}` }}>{challenges.length}</span> Challenges</span>
              <span><span style={{ color: amber, textShadow: `0 0 6px ${amber}` }}>{stats.global.participants.toLocaleString()}</span> Participants</span>
              <span><span style={{ color: amber, textShadow: `0 0 6px ${amber}` }}>{stats.global.gamesPlayed.toLocaleString()}</span> Games played</span>
            </p>
          )}
        </div>

        <div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1.5rem',
          }}>
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

            {/* "Design a challenge" placeholder */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              border: `1px dashed ${amberDim}`,
              overflow: 'hidden',
              height: '100%',
              background: bg,
            }}>
              <div style={{
                position: 'relative',
                height: '12rem',
                background: '#0a0800',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                borderBottom: `1px dashed ${amberDim}`,
              }}>
                <svg viewBox="0 0 100 100" style={{ width: '8rem', height: '8rem', color: amberDim, opacity: 0.4 }}>
                  <line x1="50" y1="30" x2="50" y2="70" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                  <line x1="30" y1="50" x2="70" y2="50" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                </svg>
              </div>
              <div style={{
                background: bg,
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                flex: 1,
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <h4 style={{
                    fontFamily: '"Courier New", monospace',
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    color: amberDim,
                    textShadow: `0 0 6px ${amberDim}`,
                    margin: 0,
                  }}>Design a challenge</h4>
                  <p style={{
                    fontFamily: '"Courier New", monospace',
                    fontSize: '0.78rem',
                    color: amberDim,
                    textShadow: `0 0 4px ${amberDim}`,
                    margin: 0,
                    opacity: 0.7,
                  }}>
                    We are looking for challenge designers! If you have an idea for a new challenge, reach out to us.
                  </p>
                </div>
                <a href="https://github.com/nicolapps/arena" style={{
                  marginTop: 'auto',
                  padding: '0.4rem 1rem',
                  border: `1px solid ${amberDim}`,
                  color: amberDim,
                  fontFamily: '"Courier New", monospace',
                  fontSize: '0.75rem',
                  textAlign: 'center',
                  textDecoration: 'none',
                  textShadow: `0 0 4px ${amberDim}`,
                  letterSpacing: '0.08em',
                  display: 'block',
                  opacity: 0.6,
                }}>
                  [GET IN TOUCH]
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
