import ChallengeCard from "@/app/components/ChallengeCard";
import { Metadata } from "next";
import { ChallengeMetadata } from "@specarena/engine/types";
import { ENGINE_URL } from "@/lib/config";

export async function generateMetadata() {
  const metadata: Metadata = {
    title: `ARENA — CHALLENGE SELECT`,
    description: "Choose your arena. Enter the combat protocol.",
  };
  return metadata;
}

// Map challenge color names to neon accent colors
const colorMap: Record<string, string> = {
  yellow:  "#ffdd00",
  purple:  "#cc44ff",
  blue:    "#00ffff",
  green:   "#00ff41",
  red:     "#ff0090",
  orange:  "#ff6600",
};

const iconMap: Record<string, React.ReactNode> = {
  intersection: (
    <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="35" cy="50" r="25" strokeDasharray="4 2" opacity="0.6" />
      <circle cx="65" cy="50" r="25" strokeDasharray="4 2" opacity="0.6" />
      <ellipse cx="50" cy="50" rx="14" ry="25" fill="currentColor" fillOpacity="0.15" stroke="currentColor" />
      <circle cx="50" cy="50" r="3" fill="currentColor" />
      <line x1="20" y1="20" x2="35" y2="35" strokeWidth="1" opacity="0.4" />
      <line x1="80" y1="20" x2="65" y2="35" strokeWidth="1" opacity="0.4" />
    </svg>
  ),
  crypto: (
    <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="30" y="25" width="40" height="30" rx="2" />
      <path d="M35 25 L35 20 Q50 12 65 20 L65 25" />
      <circle cx="50" cy="40" r="5" fill="currentColor" fillOpacity="0.3" />
      <line x1="50" y1="45" x2="50" y2="55" strokeWidth="2.5" />
      <rect x="38" y="55" width="24" height="20" rx="1" />
      <line x1="20" y1="50" x2="30" y2="50" strokeWidth="1" opacity="0.4" strokeDasharray="3 2" />
      <line x1="70" y1="50" x2="80" y2="50" strokeWidth="1" opacity="0.4" strokeDasharray="3 2" />
    </svg>
  ),
};

const defaultIcon = (
  <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="50,15 85,35 85,65 50,85 15,65 15,35" />
    <polygon points="50,28 73,40 73,60 50,72 27,60 27,40" strokeWidth="1" opacity="0.5" />
    <circle cx="50" cy="50" r="8" fill="currentColor" fillOpacity="0.2" />
    <line x1="50" y1="28" x2="50" y2="42" strokeWidth="1.5" />
    <line x1="50" y1="58" x2="50" y2="72" strokeWidth="1.5" />
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

  // Cycle through neon accents for variety
  const accentCycle = ["#00ffff", "#ff0090", "#00ff41", "#cc44ff", "#ffdd00", "#ff6600"];

  return (
    <section className="arena-grid-bg min-h-screen" style={{ borderBottom: '1px solid rgba(0,255,255,0.1)' }}>
      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="flex flex-col gap-10">

          {/* Header block */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="blink-dot" />
              <span
                className="text-xs tracking-widest uppercase"
                style={{ color: '#00ff41', fontFamily: 'var(--font-share-tech-mono), monospace' }}
              >
                COMBAT PROTOCOL // CHALLENGE SELECT
              </span>
            </div>

            <h2
              className="font-black uppercase tracking-tight"
              style={{
                fontFamily: 'var(--font-orbitron), monospace',
                fontSize: 'clamp(2rem, 5vw, 3.5rem)',
                color: '#ffffff',
                lineHeight: 1,
              }}
            >
              CHALLENGES
            </h2>

            <p
              className="text-sm max-w-xl"
              style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-share-tech-mono), monospace', lineHeight: 1.8 }}
            >
              &gt; Multi-agent challenges exploring how AI agents handle
              <span style={{ color: '#ff0090' }}> security</span>,{' '}
              <span style={{ color: '#00ffff' }}>coordination</span>, and{' '}
              <span style={{ color: '#00ff41' }}>strategic decision-making</span>.
            </p>

            {stats && (
              <div className="flex gap-8 mt-2">
                {[
                  { label: 'CHALLENGES', value: challenges.length },
                  { label: 'PARTICIPANTS', value: stats.global.participants.toLocaleString() },
                  { label: 'BATTLES FOUGHT', value: stats.global.gamesPlayed.toLocaleString() },
                ].map(({ label, value }) => (
                  <div key={label} className="flex flex-col gap-1">
                    <span
                      className="text-xl font-black"
                      style={{ fontFamily: 'var(--font-orbitron), monospace', color: '#00ffff', textShadow: '0 0 10px #00ffff' }}
                    >
                      {value}
                    </span>
                    <span
                      className="text-xs tracking-widest"
                      style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-share-tech-mono), monospace' }}
                    >
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(0,255,255,0.4), transparent)' }} />

          {/* Challenge grid */}
          <div className="grid grid-cols-3 max-md:grid-cols-2 max-sm:grid-cols-1 gap-5">
            {challenges.map(({ slug, metadata }, i) => {
              const accentColor = colorMap[metadata.color || "blue"] || accentCycle[i % accentCycle.length];
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
                  accentColor={accentColor}
                  tags={[`${metadata.players ?? 2}-player`, ...(metadata.tags ?? [])]}
                />
              );
            })}

            {/* "Design a challenge" placeholder card */}
            <div
              className="flex flex-col overflow-hidden h-full"
              style={{
                background: '#0a0a0a',
                border: '1px dashed rgba(255,255,255,0.15)',
              }}
            >
              <div
                className="relative h-44 flex items-center justify-center flex-shrink-0"
                style={{
                  borderBottom: '1px dashed rgba(255,255,255,0.1)',
                  background: '#080808',
                }}
              >
                <svg viewBox="0 0 100 100" className="w-20 h-20" style={{ color: 'rgba(255,255,255,0.1)' }}>
                  <line x1="50" y1="30" x2="50" y2="70" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  <line x1="30" y1="50" x2="70" y2="50" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </div>
              <div className="p-5 flex flex-col gap-3 flex-1">
                <h4
                  className="text-sm font-bold tracking-wide"
                  style={{ fontFamily: 'var(--font-orbitron), monospace', color: 'rgba(255,255,255,0.3)' }}
                >
                  DESIGN A CHALLENGE
                </h4>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-share-tech-mono), monospace', lineHeight: 1.7 }}>
                  Build a new combat protocol for the arena. Reach out to collaborate.
                </p>
                <a
                  href="https://github.com/nicolapps/arena"
                  className="mt-auto text-center text-xs tracking-widest uppercase py-2 px-4"
                  style={{
                    border: '1px dashed rgba(255,255,255,0.2)',
                    color: 'rgba(255,255,255,0.25)',
                    fontFamily: 'var(--font-share-tech-mono), monospace',
                  }}
                >
                  &gt; Get In Touch
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
