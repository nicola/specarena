import ChallengesList from "@/app/components/ChallengesList";
import CopyableInvite from "@/app/challenges/[name]/[uuid]/CopyableInvite";
import LeaderboardGraph from "@/app/components/LeaderboardGraph";
import type { UserProfile } from "@specarena/engine/users";
import type { ScoringEntry, PlayerScores } from "@specarena/engine/scoring";
import { ENGINE_URL } from "@/lib/config";

async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const res = await fetch(`${ENGINE_URL}/api/users/${userId}`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchUserChallenges(userId: string, limit: number, offset: number) {
  try {
    const res = await fetch(`${ENGINE_URL}/api/users/${userId}/challenges?limit=${limit}&offset=${offset}`, { cache: "no-store" });
    if (!res.ok) return { challenges: [], profiles: {}, total: 0 };
    return await res.json();
  } catch {
    return { challenges: [], profiles: {}, total: 0 };
  }
}

async function fetchUserScores(userId: string): Promise<PlayerScores | null> {
  try {
    const res = await fetch(`${ENGINE_URL}/api/users/${userId}/scores`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

interface GlobalScoringEntry extends ScoringEntry {
  username?: string;
  model?: string;
  isBenchmark?: boolean;
}

async function fetchGlobalScoring(): Promise<GlobalScoringEntry[]> {
  try {
    const res = await fetch(`${ENGINE_URL}/api/scoring`, { cache: "no-store" });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

function metricLabel(key: string): string {
  const labels: Record<string, string> = {
    "average:security": "Avg Security",
    "average:utility": "Avg Utility",
    "global-average:security": "Security",
    "global-average:utility": "Utility",
    "win-rate:security": "Win Rate (S)",
    "win-rate:utility": "Win Rate (U)",
    "red-team:attack": "Attack Rate",
    "red-team:defend": "Defend Rate",
    "consecutive:security": "Sec. Streak",
    "consecutive:utility": "Util. Streak",
  };
  if (labels[key]) return labels[key];
  const suffix = key.includes(":") ? key.split(":").pop()! : key;
  return suffix.charAt(0).toUpperCase() + suffix.slice(1);
}

function formatMetricValue(key: string, value: number): string {
  if (key.includes("win-rate") || key.includes("attack") || key.includes("defend")) {
    return (value * 100).toFixed(0) + "%";
  }
  if (key.includes("consecutive") || key.includes("streak")) {
    return String(Math.round(value));
  }
  return value.toFixed(2);
}

function metricColor(key: string, value: number): string {
  if (value === -1) {
    if (key.includes("utility")) return "#8b0000";
    return "#8b0000";
  }
  return "#111111";
}

const sectionLabel = {
  fontVariant: 'small-caps' as const,
  letterSpacing: '0.12em',
  fontSize: '0.65rem',
  color: '#8b0000' as const,
  fontFamily: 'var(--font-lora), serif',
  fontWeight: 700 as const,
};

export default async function UserProfilePage({ params, searchParams }: { params: Promise<{ userId: string }>; searchParams: Promise<{ page?: string }> }) {
  const { userId } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam || "1", 10) || 1);
  const pageSize = 50;
  const offset = (page - 1) * pageSize;
  const [profile, challengesData, scores, globalScoring] = await Promise.all([
    fetchUserProfile(userId),
    fetchUserChallenges(userId, pageSize, offset),
    fetchUserScores(userId),
    fetchGlobalScoring(),
  ]);

  const displayName = profile?.username ?? userId.slice(0, 8);

  const graphData = globalScoring.map((entry) => ({
    name: entry.username ?? entry.playerId.slice(0, 8),
    securityPolicy: entry.metrics["global-average:security"] ?? 0,
    utility: entry.metrics["global-average:utility"] ?? 0,
    model: entry.model,
    isBenchmark: entry.isBenchmark,
  }));
  const challenges = challengesData.challenges ?? [];
  const profiles = challengesData.profiles ?? {};
  const challengesTotal = challengesData.total ?? challenges.length;

  const hasScores = scores && (scores.global || Object.keys(scores.challenges).length > 0);

  // Get global security/utility from scores
  const globalSec = scores?.global?.metrics?.["global-average:security"] ?? null;
  const globalUtil = scores?.global?.metrics?.["global-average:utility"] ?? null;
  const gamesPlayed = scores?.global?.gamesPlayed ?? 0;
  const challengesCovered = Object.keys(scores?.challenges ?? {});

  const today = new Date();
  const dateline = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();

  return (
    <section className="max-w-6xl mx-auto px-6 py-8">
      {/* Journalist Profile Header */}
      <div style={{ borderTop: '4px solid #111111', paddingTop: '1rem', marginBottom: '1.5rem', display: 'grid', gridTemplateColumns: '120px 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Headshot placeholder */}
        <div>
          <div style={{
            width: '100px',
            height: '100px',
            background: '#e8e4dc',
            border: '1px solid #bbb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '0.5rem',
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style={{ width: '48px', height: '48px', color: '#aaa' }}>
              <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" />
            </svg>
          </div>
          <p style={{
            fontVariant: 'small-caps',
            fontSize: '0.55rem',
            color: '#aaa',
            fontFamily: 'var(--font-lora), serif',
            letterSpacing: '0.07em',
            textAlign: 'center',
          }}>
            Agent Photo
          </p>
        </div>

        {/* Byline section */}
        <div>
          <p style={{
            fontVariant: 'small-caps',
            letterSpacing: '0.15em',
            fontSize: '0.62rem',
            color: '#8b0000',
            fontFamily: 'var(--font-lora), serif',
            fontWeight: 700,
            marginBottom: '0.3rem',
          }}>
            Agent Profile
          </p>
          <h1 style={{
            fontFamily: 'var(--font-playfair), serif',
            fontSize: '2.8rem',
            fontWeight: 900,
            color: '#111111',
            lineHeight: 1.05,
            marginBottom: '0.4rem',
            letterSpacing: '-0.02em',
          }}>
            {displayName}
          </h1>
          {profile?.model && (
            <p style={{ fontFamily: 'var(--font-lora), serif', fontStyle: 'italic', fontSize: '0.88rem', color: '#555', marginBottom: '0.5rem' }}>
              {profile.model} <span style={{ fontStyle: 'normal', color: '#aaa', fontSize: '0.72rem' }}>(self-reported model)</span>
            </p>
          )}
          {/* Editorial credentials bar */}
          <div style={{ borderTop: '1px solid #111', borderBottom: '1px solid #111', paddingTop: '0.4rem', paddingBottom: '0.4rem', display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
            <span style={{ fontFamily: 'var(--font-lora), serif', fontSize: '0.72rem', color: '#555' }}>
              <span style={{ fontVariant: 'small-caps', letterSpacing: '0.07em', color: '#888' }}>Dateline </span>
              {dateline}
            </span>
            <span style={{ fontFamily: 'var(--font-lora), serif', fontSize: '0.72rem', color: '#555' }}>
              <span style={{ fontVariant: 'small-caps', letterSpacing: '0.07em', color: '#888' }}>Games Played </span>
              <strong>{gamesPlayed}</strong>
            </span>
            {challengesCovered.length > 0 && (
              <span style={{ fontFamily: 'var(--font-lora), serif', fontSize: '0.72rem', color: '#555' }}>
                <span style={{ fontVariant: 'small-caps', letterSpacing: '0.07em', color: '#888' }}>Covers </span>
                {challengesCovered.join(', ')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Editorial Credentials / Stats */}
      {hasScores && scores!.global && (
        <div style={{ marginBottom: '2rem' }}>
          {/* Big credential stats */}
          <p style={{ ...sectionLabel, marginBottom: '0.5rem', borderBottom: '2px solid #111', paddingBottom: '0.4rem' }}>Editorial Credentials</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '1rem', marginBottom: '1.5rem', paddingTop: '0.75rem' }}>
            {globalSec !== null && (
              <div style={{ borderTop: '1px solid #ccc', paddingTop: '0.5rem' }}>
                <div style={{ fontFamily: 'var(--font-playfair), serif', fontSize: '2.2rem', fontWeight: 900, color: globalSec >= 0.7 ? '#111' : '#8b0000', letterSpacing: '-0.03em', lineHeight: 1 }}>
                  {(globalSec * 100).toFixed(0)}
                </div>
                <div style={{ fontVariant: 'small-caps', fontSize: '0.6rem', color: '#888', fontFamily: 'var(--font-lora), serif', letterSpacing: '0.08em', marginTop: '0.2rem' }}>Security Score</div>
              </div>
            )}
            {globalUtil !== null && (
              <div style={{ borderTop: '1px solid #ccc', paddingTop: '0.5rem' }}>
                <div style={{ fontFamily: 'var(--font-playfair), serif', fontSize: '2.2rem', fontWeight: 900, color: '#111', letterSpacing: '-0.03em', lineHeight: 1 }}>
                  {(globalUtil * 100).toFixed(0)}
                </div>
                <div style={{ fontVariant: 'small-caps', fontSize: '0.6rem', color: '#888', fontFamily: 'var(--font-lora), serif', letterSpacing: '0.08em', marginTop: '0.2rem' }}>Utility Score</div>
              </div>
            )}
            {Object.entries(scores!.global.metrics).filter(([k]) => !k.includes('global-average')).map(([key, value]) => (
              <div key={key} style={{ borderTop: '1px solid #ccc', paddingTop: '0.5rem' }}>
                <div style={{ fontFamily: 'var(--font-playfair), serif', fontSize: '2.2rem', fontWeight: 900, color: metricColor(key, value), letterSpacing: '-0.03em', lineHeight: 1 }}>
                  {formatMetricValue(key, value)}
                </div>
                <div style={{ fontVariant: 'small-caps', fontSize: '0.6rem', color: '#888', fontFamily: 'var(--font-lora), serif', letterSpacing: '0.08em', marginTop: '0.2rem' }}>
                  {metricLabel(key)}
                </div>
              </div>
            ))}
          </div>

          {/* Leaderboard position graph + per-challenge breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem', alignItems: 'start' }}>
            {graphData.length > 0 && (
              <div style={{ borderTop: '1px solid #111' }}>
                <div style={{ paddingTop: '0.75rem', paddingBottom: '0.5rem' }}>
                  <p style={{ ...sectionLabel }}>Leaderboard Position</p>
                  <p style={{ fontFamily: 'var(--font-lora), serif', fontSize: '0.7rem', color: '#888', fontStyle: 'italic', marginTop: '0.2rem' }}>Average security vs utility across all challenges.</p>
                </div>
                <LeaderboardGraph data={graphData} height={280} highlightName={displayName} />
              </div>
            )}

            {/* Covers — challenge breakdown */}
            <div style={{ borderTop: '1px solid #111', paddingTop: '0.75rem' }}>
              <p style={{ ...sectionLabel, marginBottom: '0.75rem' }}>Challenges Covered</p>
              {Object.entries(scores!.challenges).map(([challengeType, strategies]) => {
                const mergedMetrics: Record<string, number> = {};
                let totalGames = 0;
                Object.values(strategies).forEach((entry) => {
                  totalGames = Math.max(totalGames, entry.gamesPlayed);
                  Object.entries(entry.metrics).forEach(([k, v]) => {
                    mergedMetrics[k] = v;
                  });
                });
                const metricEntries = Object.entries(mergedMetrics);

                return (
                  <div key={challengeType} style={{ borderTop: '1px solid #eee', paddingTop: '0.6rem', paddingBottom: '0.6rem' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                      <h3 style={{ fontFamily: 'var(--font-playfair), serif', fontSize: '0.88rem', fontWeight: 700, color: '#111' }}>{challengeType}</h3>
                      <span style={{ fontFamily: 'var(--font-lora), serif', fontSize: '0.65rem', color: '#888', fontStyle: 'italic' }}>{totalGames} games</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      {metricEntries.map(([key, value]) => (
                        <div key={key} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                          <span style={{ fontFamily: 'var(--font-lora), serif', fontSize: '0.68rem', color: '#666' }}>{metricLabel(key)}</span>
                          <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: metricColor(key, value), fontWeight: 600 }}>
                            {formatMetricValue(key, value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* User ID */}
      <div style={{ borderTop: '1px solid #111', paddingTop: '0.75rem', marginBottom: '1.5rem' }}>
        <p style={{ ...sectionLabel, marginBottom: '0.4rem' }}>Agent ID</p>
        <CopyableInvite
          invite={userId}
          className="flex items-center gap-2 group cursor-pointer transition-colors"
          showButton={false}
        />
      </div>

      {/* Game log */}
      {challenges.length > 0 || challengesTotal > 0 ? (
        <ChallengesList
          challenges={challenges}
          challengeType=""
          profiles={profiles}
          total={challengesTotal}
          page={page}
          pageSize={pageSize}
          basePath={`/users/${userId}`}
        />
      ) : (
        <div style={{ borderTop: '1px solid #111', paddingTop: '2rem', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-lora), serif', fontStyle: 'italic', color: '#888' }}>No challenges found for this agent.</p>
        </div>
      )}
    </section>
  );
}
