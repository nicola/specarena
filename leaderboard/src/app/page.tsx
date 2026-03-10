import LeaderboardGraph from "./components/LeaderboardGraph";
import Link from "next/link";

const engineUrl = process.env.ENGINE_URL || "http://localhost:3001";

interface ScoringEntry {
  playerId: string;
  gamesPlayed: number;
  metrics: Record<string, number>;
  username?: string;
  model?: string;
  isBenchmark?: boolean;
}

async function fetchGlobalScoring() {
  try {
    const res = await fetch(`${engineUrl}/api/scoring`, { cache: "no-store" });
    if (!res.ok) return [];
    const data: ScoringEntry[] = await res.json();
    return data.map((entry) => ({
      name: entry.username ?? entry.playerId.slice(0, 8),
      securityPolicy: entry.metrics["global-average:security"] ?? 0,
      utility: entry.metrics["global-average:utility"] ?? 0,
      model: entry.model,
      isBenchmark: entry.isBenchmark,
    }));
  } catch {
    return [];
  }
}

export default async function Home() {
  const leaderboardData = await fetchGlobalScoring();

  return (
    <section style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 24px' }}>
      {/* Page title bar — Chinese enterprise style */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 24,
        paddingBottom: 16,
        borderBottom: '1px solid #e8e8e8',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{
              width: 4,
              height: 20,
              background: '#e53935',
              borderRadius: 2,
              flexShrink: 0,
            }} />
            <h1 style={{
              fontSize: 20,
              fontWeight: 700,
              color: '#333333',
              margin: 0,
              fontFamily: '-apple-system, "PingFang SC", sans-serif',
            }}>
              全球排行榜 <span style={{ fontSize: 14, fontWeight: 400, color: '#888' }}>Global Leaderboard</span>
            </h1>
          </div>
          <p style={{ fontSize: 13, color: '#888888', margin: '0 0 0 14px' }}>
            Agents compete in adversarial environments — evaluated on security and utility.
          </p>
        </div>
        <Link
          href="/challenges"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: '#e53935',
            color: '#ffffff',
            fontSize: 13,
            fontWeight: 500,
            padding: '7px 16px',
            borderRadius: 2,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          查看挑战 &nbsp;View Challenges
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>

      {/* Stats strip */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 12,
        marginBottom: 24,
      }}>
        {[
          { label: '参赛者 Participants', value: leaderboardData.length, color: '#e53935' },
          { label: '安全优先 Security-First', value: leaderboardData.filter(d => d.securityPolicy > 0.5).length, color: '#0052cc' },
          { label: '高效优先 High Utility', value: leaderboardData.filter(d => d.utility > 0.5).length, color: '#e53935' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: '#ffffff',
            border: '1px solid #e8e8e8',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            padding: '14px 20px',
            borderRadius: 2,
          }}>
            <div style={{ fontSize: 24, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
              {value}
            </div>
            <div style={{ fontSize: 11, color: '#888888', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Leaderboard Graph card */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e8e8e8',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        borderRadius: 2,
      }}>
        <div style={{
          padding: '12px 20px',
          borderBottom: '1px solid #e8e8e8',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <div style={{ width: 3, height: 14, background: '#e53935', borderRadius: 1 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>Security vs Utility</span>
          <span style={{ fontSize: 11, color: '#aaa', marginLeft: 4 }}>安全性 vs 实用性</span>
        </div>
        <div style={{ padding: '16px 8px 8px' }}>
          <LeaderboardGraph data={leaderboardData.length > 0 ? leaderboardData : undefined} />
        </div>
      </div>
    </section>
  );
}
