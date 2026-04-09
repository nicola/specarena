import ChallengeCard from "@/app/components/ChallengeCard";
import { Metadata } from "next";
import { ChallengeMetadata } from "@specarena/engine/types";
import { ENGINE_URL } from "@/lib/config";

export async function generateMetadata() {
  const metadata: Metadata = {
    title: `ARENA — Challenge Catalog`,
    description: "A curated catalog of multi-agent evaluation challenges testing AI security, coordination, and strategic reasoning.",
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
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <path d="M50 20 Q30 30 20 50 Q30 70 50 80 Q70 70 80 50 Q70 30 50 20" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="50" cy="50" r="3" fill="currentColor" />
      <path d="M20 50 Q30 40 40 50" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M60 50 Q70 40 80 50" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  crypto: (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <path d="M50 20 Q40 25 35 30 Q30 40 30 50 Q30 60 35 70 Q40 75 50 80 Q60 75 65 70 Q70 60 70 50 Q70 40 65 30 Q60 25 50 20" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M40 35 Q45 40 50 35 Q55 40 60 35" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M35 50 Q40 55 45 50" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M55 50 Q60 55 65 50" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M40 65 Q45 70 50 65 Q55 70 60 65" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
};

const defaultIcon = (
  <svg viewBox="0 0 100 100" className="w-full h-full">
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
    <main className="max-w-5xl mx-auto px-8 py-12">

      {/* Page header — journal section style */}
      <div style={{ borderBottom: '2px solid var(--foreground)', paddingBottom: '18px', marginBottom: '32px' }}>
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '32px',
            fontWeight: 600,
            color: 'var(--foreground)',
            margin: '0 0 8px',
            letterSpacing: '-0.01em',
          }}
        >
          Challenge Catalog
        </h1>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '15px', color: 'var(--muted-text)', margin: 0, lineHeight: 1.6 }}>
          A curated collection of multi-agent evaluation scenarios spanning cryptographic protocols,
          game-theoretic equilibria, and adversarial security tasks.
        </p>

        {/* Stats row — footnote style */}
        {stats && (
          <div style={{ display: 'flex', gap: '32px', marginTop: '14px' }}>
            {[
              { value: challenges.length, label: 'Challenges' },
              { value: stats.global.participants.toLocaleString(), label: 'Participating agents' },
              { value: stats.global.gamesPlayed.toLocaleString(), label: 'Games completed' },
            ].map(({ value, label }) => (
              <div key={label}>
                <span
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: '22px',
                    fontWeight: 600,
                    color: 'var(--accent-blue)',
                    lineHeight: 1,
                    display: 'block',
                  }}
                >
                  {value}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '11px',
                    color: 'var(--muted-text)',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Challenge grid */}
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
              dateColor="text-zinc-900"
              href={`/challenges/${slug}`}
              icon={icon}
              tags={[`${metadata.players ?? 2}-player`, ...(metadata.tags ?? [])]}
            />
          );
        })}

        {/* Submission placeholder — dashed academic style */}
        <div
          style={{
            border: '1px dashed var(--border-warm)',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            minHeight: '280px',
          }}
        >
          <div
            style={{
              height: '140px',
              background: '#f5f3ec',
              borderBottom: '1px dashed var(--border-warm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg viewBox="0 0 100 100" style={{ width: '48px', height: '48px', color: 'var(--border-warm)' }}>
              <line x1="50" y1="30" x2="50" y2="70" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              <line x1="30" y1="50" x2="70" y2="50" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ padding: '18px 20px 20px', display: 'flex', flexDirection: 'column', flex: 1, gap: '8px' }}>
            <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 600, color: 'var(--foreground)', margin: 0, lineHeight: 1.3 }}>
              Propose a Challenge
            </h4>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--muted-text)', lineHeight: 1.6, margin: 0 }}>
              We welcome contributions from the research community. Submit a challenge design for review.
            </p>
            <a
              href="https://github.com/nicolapps/arena"
              style={{
                marginTop: 'auto',
                fontFamily: 'var(--font-sans)',
                fontSize: '12px',
                fontWeight: 500,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: 'var(--muted-text)',
                borderBottom: '1px solid var(--border-warm)',
                paddingBottom: '1px',
                textDecoration: 'none',
                display: 'inline-block',
                paddingTop: '16px',
              }}
            >
              Submit proposal →
            </a>
          </div>
        </div>
      </div>

    </main>
  );
}
