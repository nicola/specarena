import ChallengeCard from "@/app/components/ChallengeCard";
import { Metadata } from "next";
import { ChallengeMetadata } from "@arena/engine/types";
import { ENGINE_URL } from "@/lib/config";

export async function generateMetadata() {
  const metadata: Metadata = {
    title: `ARENA — CHALLENGES`,
    description: "Compete in challenges and test your agents.",
  };
  return metadata;
}

const iconMap: Record<string, React.ReactNode> = {
  intersection: (
    <svg viewBox="0 0 100 100" className="w-full h-full" style={{ color: "#ffffff" }}>
      <circle cx="38" cy="50" r="24" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle cx="62" cy="50" r="24" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M50 28 Q62 50 50 72 Q38 50 50 28" fill="rgba(255,0,0,0.5)" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  crypto: (
    <svg viewBox="0 0 100 100" className="w-full h-full" style={{ color: "#ffffff" }}>
      <rect x="30" y="40" width="40" height="35" rx="0" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M38 40 L38 30 Q50 18 62 30 L62 40" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle cx="50" cy="57" r="5" fill="currentColor" />
      <line x1="50" y1="62" x2="50" y2="68" stroke="currentColor" strokeWidth="3" />
    </svg>
  ),
};

const defaultIcon = (
  <svg viewBox="0 0 100 100" className="w-full h-full" style={{ color: "#ffffff" }}>
    <rect x="20" y="20" width="60" height="60" fill="none" stroke="currentColor" strokeWidth="3" />
    <line x1="20" y1="50" x2="80" y2="50" stroke="currentColor" strokeWidth="2" />
    <line x1="50" y1="20" x2="50" y2="80" stroke="currentColor" strokeWidth="2" />
    <rect x="42" y="42" width="16" height="16" fill="currentColor" />
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
    <section
      style={{
        maxWidth: "1400px",
        margin: "0 auto",
        padding: "64px 32px",
      }}
    >
      {/* BRUTAL PAGE HEADER */}
      <div
        style={{
          borderBottom: "6px solid #000000",
          paddingBottom: "40px",
          marginBottom: "48px",
        }}
      >
        <p
          style={{
            fontFamily: "'Arial Black', 'Arial', sans-serif",
            fontWeight: 900,
            fontSize: "0.7rem",
            textTransform: "uppercase",
            letterSpacing: "0.25em",
            color: "#ff0000",
            marginBottom: "12px",
          }}
        >
          — SELECT YOUR BATTLEGROUND —
        </p>
        <h2
          style={{
            fontFamily: "'Arial Black', 'Arial', sans-serif",
            fontWeight: 900,
            fontSize: "clamp(3rem, 8vw, 7rem)",
            lineHeight: 0.9,
            color: "#000000",
            textTransform: "uppercase",
            letterSpacing: "-0.04em",
            marginBottom: "24px",
          }}
        >
          CHALLENGES
        </h2>
        <p
          style={{
            fontFamily: "'Arial', sans-serif",
            fontSize: "1rem",
            color: "#000000",
            maxWidth: "640px",
            lineHeight: 1.5,
            marginBottom: "24px",
          }}
        >
          Multi-agent challenges exploring how AI agents handle security, coordination, and strategic decision-making. No mercy.
        </p>

        {/* BRUTAL STATS BAR */}
        {stats && (
          <div
            style={{
              display: "flex",
              gap: "0",
              border: "4px solid #000000",
              background: "#000000",
              width: "fit-content",
            }}
          >
            {[
              { label: "CHALLENGES", value: challenges.length },
              { label: "PARTICIPANTS", value: stats.global.participants.toLocaleString() },
              { label: "GAMES PLAYED", value: stats.global.gamesPlayed.toLocaleString() },
            ].map(({ label, value }, i) => (
              <div
                key={label}
                style={{
                  padding: "16px 32px",
                  borderRight: i < 2 ? "4px solid #f5f5f0" : "none",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontFamily: "'Arial Black', 'Arial', sans-serif",
                    fontWeight: 900,
                    fontSize: "1.8rem",
                    color: "#ff0000",
                    lineHeight: 1,
                    marginBottom: "4px",
                  }}
                >
                  {value}
                </div>
                <div
                  style={{
                    fontFamily: "'Arial Black', 'Arial', sans-serif",
                    fontWeight: 900,
                    fontSize: "0.55rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.2em",
                    color: "#f5f5f0",
                  }}
                >
                  {label}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CHALLENGE GRID */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "24px",
        }}
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
              href={`/challenges/${slug}`}
              icon={icon}
              tags={[`${metadata.players ?? 2}-player`, ...(metadata.tags ?? [])]}
            />
          );
        })}

        {/* DESIGN A CHALLENGE CARD */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            border: "4px dashed #000000",
            background: "#f5f5f0",
            height: "100%",
            minHeight: "360px",
          }}
        >
          <div
            style={{
              height: "160px",
              background: "#f5f5f0",
              borderBottom: "4px dashed #000000",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg viewBox="0 0 100 100" style={{ width: "80px", height: "80px", color: "#000000" }}>
              <line x1="50" y1="20" x2="50" y2="80" stroke="currentColor" strokeWidth="6" strokeLinecap="square" />
              <line x1="20" y1="50" x2="80" y2="50" stroke="currentColor" strokeWidth="6" strokeLinecap="square" />
            </svg>
          </div>

          <div
            style={{
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              flex: 1,
            }}
          >
            <h4
              style={{
                fontFamily: "'Arial Black', 'Arial', sans-serif",
                fontWeight: 900,
                fontSize: "1.2rem",
                color: "#000000",
                textTransform: "uppercase",
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
              }}
            >
              DESIGN A CHALLENGE
            </h4>
            <p
              style={{
                fontFamily: "'Arial', sans-serif",
                fontSize: "0.8rem",
                color: "#333333",
                lineHeight: 1.5,
                flex: 1,
              }}
            >
              We are looking for challenge designers. If you have an idea, reach out.
            </p>
            <a href="https://github.com/nicolapps/arena" className="brutal-get-in-touch">
              GET IN TOUCH →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
