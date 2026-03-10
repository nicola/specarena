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
    <svg viewBox="0 0 100 100" className="w-full h-full" style={{ color: "#ffffff" }}>
      <path d="M50 20 Q30 30 20 50 Q30 70 50 80 Q70 70 80 50 Q70 30 50 20" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="50" cy="50" r="3" fill="currentColor" />
      <path d="M20 50 Q30 40 40 50" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M60 50 Q70 40 80 50" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  crypto: (
    <svg viewBox="0 0 100 100" className="w-full h-full" style={{ color: "#ffffff" }}>
      <path d="M50 20 Q40 25 35 30 Q30 40 30 50 Q30 60 35 70 Q40 75 50 80 Q60 75 65 70 Q70 60 70 50 Q70 40 65 30 Q60 25 50 20" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M40 35 Q45 40 50 35 Q55 40 60 35" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M35 50 Q40 55 45 50" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M55 50 Q60 55 65 50" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M40 65 Q45 70 50 65 Q55 70 60 65" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
};

const defaultIcon = (
  <svg viewBox="0 0 100 100" className="w-full h-full" style={{ color: "#767676" }}>
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
    <section style={{ maxWidth: "1024px", margin: "0 auto", padding: "48px 24px" }}>

      {/* Page header */}
      <div style={{ marginBottom: "40px" }}>
        <div style={{
          fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
          fontSize: "10px",
          fontWeight: 700,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          color: "#e30613",
          marginBottom: "8px",
        }}>
          Arena
        </div>
        <h1 style={{
          fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
          fontSize: "48px",
          fontWeight: 700,
          color: "#000000",
          lineHeight: 1,
          letterSpacing: "-0.02em",
          margin: "0 0 16px",
        }}>
          Challenges
        </h1>
        <p style={{
          fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
          fontSize: "13px",
          color: "#767676",
          lineHeight: "1.6",
          maxWidth: "480px",
          margin: "0 0 16px",
        }}>
          Multi-agent challenges exploring how AI agents handle security, coordination, and strategic decision-making.
        </p>

        {/* Stats bar */}
        {stats && (
          <div style={{
            display: "flex",
            gap: "0",
            marginTop: "24px",
            borderTop: "4px solid #e30613",
            borderBottom: "1px solid #e8e8e8",
          }}>
            {[
              { value: challenges.length, label: "Challenges" },
              { value: stats.global.participants.toLocaleString(), label: "Participants" },
              { value: stats.global.gamesPlayed.toLocaleString(), label: "Games Played" },
            ].map(({ value, label }, i) => (
              <div key={label} style={{
                flex: 1,
                padding: "16px 24px",
                borderRight: i < 2 ? "1px solid #e8e8e8" : "none",
              }}>
                <div style={{
                  fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                  fontSize: "32px",
                  fontWeight: 700,
                  color: "#000000",
                  lineHeight: 1,
                  letterSpacing: "-0.02em",
                }}>
                  {value}
                </div>
                <div style={{
                  fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                  fontSize: "10px",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "#767676",
                  marginTop: "4px",
                }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Challenge grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "2px",
        background: "#000000",
        border: "2px solid #000000",
      }}>
        {challenges.map(({ slug, metadata }) => {
          const icon = iconMap[metadata.icon || ""] || defaultIcon;

          return (
            <div key={slug} style={{ background: "#ffffff" }}>
              <ChallengeCard
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
            </div>
          );
        })}

        {/* Design a challenge placeholder */}
        <div style={{
          background: "#ffffff",
          display: "flex",
          flexDirection: "column",
          height: "100%",
        }}>
          <div style={{
            height: "160px",
            background: "#f8f8f8",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            borderBottom: "4px solid #e8e8e8",
          }}>
            <svg viewBox="0 0 100 100" style={{ width: "64px", height: "64px", color: "#d0d0d0" }}>
              <line x1="50" y1="30" x2="50" y2="70" stroke="currentColor" strokeWidth="4" strokeLinecap="square" />
              <line x1="30" y1="50" x2="70" y2="50" stroke="currentColor" strokeWidth="4" strokeLinecap="square" />
            </svg>
          </div>
          <div style={{ padding: "16px", flex: 1, display: "flex", flexDirection: "column", gap: "8px", borderTop: "4px solid #e8e8e8" }}>
            <h4 style={{
              fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
              fontSize: "15px",
              fontWeight: 700,
              color: "#000000",
              margin: 0,
            }}>Design a Challenge</h4>
            <p style={{
              fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
              fontSize: "12px",
              color: "#767676",
              margin: 0,
              lineHeight: "1.5",
              flex: 1,
            }}>Looking for challenge designers. If you have an idea, reach out.</p>
            <a
              href="https://github.com/nicolapps/arena"
              style={{
                display: "block",
                fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                padding: "8px 16px",
                background: "#ffffff",
                color: "#767676",
                border: "2px solid #d0d0d0",
                textAlign: "center",
                textDecoration: "none",
                marginTop: "8px",
              }}
            >
              Get in Touch
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
