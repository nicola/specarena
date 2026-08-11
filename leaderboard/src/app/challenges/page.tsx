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

const iconMap: Record<string, React.ReactNode> = {
  intersection: (
    <svg viewBox="0 0 100 100" style={{ color: '#e53935' }}>
      <path d="M50 20 Q30 30 20 50 Q30 70 50 80 Q70 70 80 50 Q70 30 50 20" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="50" cy="50" r="3" fill="currentColor" />
      <path d="M20 50 Q30 40 40 50" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M60 50 Q70 40 80 50" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  crypto: (
    <svg viewBox="0 0 100 100" style={{ color: '#0052cc' }}>
      <path d="M50 20 Q40 25 35 30 Q30 40 30 50 Q30 60 35 70 Q40 75 50 80 Q60 75 65 70 Q70 60 70 50 Q70 40 65 30 Q60 25 50 20" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M40 35 Q45 40 50 35 Q55 40 60 35" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M35 50 Q40 55 45 50" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M55 50 Q60 55 65 50" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M40 65 Q45 70 50 65 Q55 70 60 65" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
};

const defaultIcon = (
  <svg viewBox="0 0 100 100" style={{ color: '#e53935' }}>
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
    <section style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 24px' }}>
      {/* Page header */}
      <div style={{
        paddingBottom: 16,
        borderBottom: '1px solid #e8e8e8',
        marginBottom: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ width: 4, height: 20, background: '#e53935', borderRadius: 2 }} />
          <h1 style={{
            fontSize: 20,
            fontWeight: 700,
            color: '#333333',
            margin: 0,
            fontFamily: '-apple-system, "PingFang SC", sans-serif',
          }}>
            挑战列表 <span style={{ fontSize: 14, fontWeight: 400, color: '#888' }}>Challenges</span>
          </h1>
        </div>
        <p style={{ fontSize: 13, color: '#888888', margin: '0 0 0 14px' }}>
          Multi-agent challenges exploring security, coordination, and strategic decision-making.
        </p>

        {/* Stats bar */}
        {stats && (
          <div style={{
            display: 'flex',
            gap: 24,
            marginTop: 14,
            marginLeft: 14,
          }}>
            {[
              { label: '挑战数', labelEn: 'Challenges', value: challenges.length },
              { label: '参赛者', labelEn: 'Participants', value: stats.global.participants.toLocaleString() },
              { label: '对局数', labelEn: 'Games played', value: stats.global.gamesPlayed.toLocaleString() },
            ].map(({ label, labelEn, value }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#e53935' }}>{value}</span>
                <span style={{ fontSize: 11, color: '#aaa' }}>{label} {labelEn}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Challenge cards grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 16,
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

        {/* Design a challenge card */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
          border: '1px dashed #d0d0d0',
          borderRadius: 2,
          overflow: 'hidden',
          height: '100%',
        }}>
          <div style={{
            height: 140,
            background: '#fafafa',
            borderBottom: '1px dashed #e0e0e0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg viewBox="0 0 100 100" style={{ width: 60, height: 60, color: '#d0d0d0' }}>
              <line x1="50" y1="30" x2="50" y2="70" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              <line x1="30" y1="50" x2="70" y2="50" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
            <h4 style={{ fontSize: 15, fontWeight: 600, color: '#999', margin: 0 }}>设计挑战 Design a challenge</h4>
            <p style={{ fontSize: 12, color: '#aaa', margin: 0, flex: 1 }}>
              We are looking for challenge designers! Reach out to us.
            </p>
            <a
              href="https://github.com/nicolapps/arena"
              style={{
                display: 'block',
                marginTop: 12,
                padding: '8px 0',
                background: 'transparent',
                color: '#cccccc',
                textAlign: 'center',
                fontSize: 12,
                fontWeight: 500,
                textDecoration: 'none',
                borderRadius: 2,
                border: '1px dashed #d0d0d0',
              }}
            >
              联系我们 Get in touch
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
