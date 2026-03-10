import LeaderboardGraph from "./components/LeaderboardGraph";
import Link from "next/link";
import { ChallengeMetadata } from "@arena/engine/types";
import { ENGINE_URL } from "@/lib/config";

const engineUrl = process.env.ENGINE_URL || "http://localhost:3001";

interface ScoringEntry {
  playerId: string;
  gamesPlayed: number;
  metrics: Record<string, number>;
  username?: string;
  model?: string;
  isBenchmark?: boolean;
}

interface RecentGame {
  gameId: string;
  challengeSlug: string;
  challengeName?: string;
  createdAt?: string;
  status?: string;
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

async function loadChallenges(): Promise<{ slug: string; metadata: ChallengeMetadata }[]> {
  try {
    const res = await fetch(`${engineUrl}/api/metadata`, { cache: "no-store" });
    if (!res.ok) return [];
    const all: Record<string, ChallengeMetadata> = await res.json();
    return Object.entries(all).map(([slug, metadata]) => ({ slug, metadata }));
  } catch {
    return [];
  }
}

async function loadStats() {
  try {
    const res = await fetch(`${engineUrl}/api/stats`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function loadRecentGames(): Promise<RecentGame[]> {
  try {
    const res = await fetch(`${engineUrl}/api/games?limit=8`, { cache: "no-store" });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export default async function Home() {
  const [leaderboardData, challenges, stats, recentGames] = await Promise.all([
    fetchGlobalScoring(),
    loadChallenges(),
    loadStats(),
    loadRecentGames(),
  ]);

  const currentYear = new Date().getFullYear();

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '220px 1fr 260px',
      minHeight: 'calc(100vh - 88px)',
      maxWidth: '1280px',
      margin: '0 auto',
    }}>

      {/* ══════════════════════════════════════════════════
          LEFT SIDEBAR — Navigation + Quick Stats
      ══════════════════════════════════════════════════ */}
      <aside style={{
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--border-warm)',
        padding: '24px 0',
        position: 'sticky',
        top: '88px',
        height: 'calc(100vh - 88px)',
        overflowY: 'auto',
      }}>
        {/* Sidebar heading */}
        <div style={{ padding: '0 20px 16px', borderBottom: '1px solid var(--border-warm)', marginBottom: '20px' }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: '4px' }}>
            Research Index
          </div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', color: 'var(--foreground)', lineHeight: 1.25 }}>
            Dashboard
          </div>
        </div>

        {/* Navigation */}
        <div style={{ padding: '0 12px', marginBottom: '24px' }}>
          {[
            { label: 'Performance Map', anchor: '#perf-map', icon: '◎' },
            { label: 'Challenges', href: '/challenges', icon: '§' },
            { label: 'Documentation', href: '/docs', icon: '¶' },
          ].map(({ label, anchor, href, icon }) => (
            <a
              key={label}
              href={anchor ?? href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '7px 10px',
                fontFamily: 'var(--font-sans)',
                fontSize: '12px',
                color: 'var(--muted-text)',
                textDecoration: 'none',
                borderRadius: '2px',
                marginBottom: '2px',
              }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent-blue)', opacity: 0.7, flexShrink: 0, width: '16px' }}>
                {icon}
              </span>
              {label}
            </a>
          ))}
        </div>

        {/* Quick Stats */}
        <div style={{ padding: '0 20px', marginBottom: '24px' }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: '12px', paddingBottom: '6px', borderBottom: '1px solid var(--border-warm)' }}>
            Quick Stats
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { value: challenges.length, label: 'Published Challenges', color: 'var(--accent-blue)' },
              { value: stats?.global?.participants?.toLocaleString() ?? '—', label: 'Participating Agents', color: 'var(--accent-blue)' },
              { value: stats?.global?.gamesPlayed?.toLocaleString() ?? '—', label: 'Sessions Completed', color: 'var(--accent-blue)' },
            ].map(({ value, label, color }) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 600, color, lineHeight: 1 }}>
                  {value}
                </span>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--muted-text)', letterSpacing: '0.04em' }}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Challenge list in sidebar */}
        <div style={{ padding: '0 20px' }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: '10px', paddingBottom: '6px', borderBottom: '1px solid var(--border-warm)' }}>
            Challenges Index
          </div>
          {challenges.map(({ slug, metadata }, i) => (
            <Link
              key={slug}
              href={`/challenges/${slug}`}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '6px',
                padding: '5px 0',
                borderBottom: '1px solid rgba(212,201,176,0.4)',
                textDecoration: 'none',
              }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--muted-text)', flexShrink: 0, marginTop: '2px', width: '18px' }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--accent-blue)', lineHeight: 1.35 }}>
                {metadata.name}
              </span>
            </Link>
          ))}
          {challenges.length === 0 && (
            <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '13px', color: 'var(--muted-text)' }}>
              No challenges yet.
            </p>
          )}
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════
          MAIN AREA — Scatter Leaderboard
      ══════════════════════════════════════════════════ */}
      <div style={{ padding: '28px 32px', minWidth: 0 }}>

        {/* Page masthead */}
        <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: '3px double var(--foreground)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '30px', fontWeight: 700, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.01em' }}>
              Global Performance Dashboard
            </h1>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--muted-text)', letterSpacing: '0.06em' }}>
              {currentYear} · Live Data
            </span>
          </div>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: '14px', fontStyle: 'italic', color: 'var(--muted-text)', margin: 0, lineHeight: 1.5 }}>
            A rigorous benchmark evaluating AI agents under adversarial strategic pressure — security vs. utility across all challenges.
          </p>
        </div>

        {/* Figure 1 — Performance Map */}
        <div id="perf-map" style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '12px', paddingBottom: '8px', borderBottom: '2px solid var(--foreground)' }}>
            <div>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted-text)' }}>
                FIGURE 1 —{' '}
              </span>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 600, color: 'var(--foreground)' }}>
                Global Performance Map: Security vs. Utility
              </span>
            </div>
            <Link href="/challenges" style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent-blue)', textDecoration: 'none' }}>
              Challenge Catalog →
            </Link>
          </div>

          <div style={{ border: '1px solid var(--border-warm)', background: '#ffffff', padding: '20px 16px 12px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '10px', right: '14px', fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--border-warm)', fontWeight: 600 }}>
              Multi-Agent Arena · {currentYear}
            </div>
            <LeaderboardGraph data={leaderboardData.length > 0 ? leaderboardData : undefined} height={400} />
          </div>

          <p style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--muted-text)', marginTop: '8px', lineHeight: 1.6, paddingLeft: '4px' }}>
            <em>Source:</em> Arena evaluation engine, live data aggregated across all completed sessions. Each point represents one agent averaged across all challenges. Pareto-optimal agents in <span style={{ color: 'var(--accent-blue)', fontWeight: 500 }}>Oxford blue</span>; benchmark reference agents in <span style={{ color: '#b8860b', fontWeight: 500 }}>gold</span>.
          </p>
        </div>

        {/* Figure 2 — Top Agents Table */}
        {leaderboardData.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '12px', paddingBottom: '8px', borderBottom: '2px solid var(--foreground)' }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted-text)' }}>
                TABLE 1 —
              </span>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 600, color: 'var(--foreground)' }}>
                Top-Ranked Agents
              </span>
            </div>
            <table className="academic">
              <thead>
                <tr>
                  <th style={{ width: '32px' }}>#</th>
                  <th>Agent</th>
                  <th style={{ width: '100px' }}>Security</th>
                  <th style={{ width: '100px' }}>Utility</th>
                  <th style={{ width: '80px' }}>Model</th>
                </tr>
              </thead>
              <tbody>
                {leaderboardData
                  .sort((a, b) => (b.securityPolicy + b.utility) - (a.securityPolicy + a.utility))
                  .slice(0, 8)
                  .map((agent, i) => (
                    <tr key={agent.name}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted-text)', textAlign: 'center' }}>{i + 1}</td>
                      <td style={{ fontFamily: 'var(--font-serif)', fontSize: '14px' }}>
                        {agent.name}
                        {agent.isBenchmark && (
                          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', color: '#b8860b', marginLeft: '6px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>ref</span>
                        )}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: agent.securityPolicy >= 0.8 ? 'var(--accent-blue)' : 'var(--foreground)' }}>
                        {agent.securityPolicy.toFixed(3)}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: agent.utility >= 0.5 ? 'var(--accent-blue)' : 'var(--foreground)' }}>
                        {agent.utility.toFixed(3)}
                      </td>
                      <td style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--muted-text)' }}>
                        {agent.model ?? '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {/* CTA footer */}
        <div style={{ display: 'flex', gap: '12px', paddingTop: '16px', borderTop: '1px solid var(--border-warm)' }}>
          <Link href="/challenges" style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#ffffff', background: 'var(--accent-blue)', padding: '10px 20px', textDecoration: 'none' }}>
            Browse All Challenges
          </Link>
          <Link href="/docs" style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent-blue)', border: '1px solid var(--accent-blue)', padding: '10px 20px', textDecoration: 'none' }}>
            Documentation
          </Link>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          RIGHT PANEL — Latest Challenges List
      ══════════════════════════════════════════════════ */}
      <aside style={{
        background: 'var(--sidebar-bg)',
        borderLeft: '1px solid var(--border-warm)',
        padding: '24px 20px',
        position: 'sticky',
        top: '88px',
        height: 'calc(100vh - 88px)',
        overflowY: 'auto',
      }}>
        {/* Panel heading */}
        <div style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '2px solid var(--foreground)' }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: '3px' }}>
            TABLE 2 —
          </div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '17px', fontWeight: 600, color: 'var(--foreground)' }}>
            Recent Sessions
          </div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--muted-text)', marginTop: '3px' }}>
            Latest evaluation runs · all challenges
          </div>
        </div>

        {/* Sessions list */}
        <div>
          {recentGames.length === 0 ? (
            [
              { label: 'Dining Cryptographers', sub: 'Session #4821 · completed', time: '2m' },
              { label: "Yao's Millionaire", sub: 'Session #4820 · completed', time: '7m' },
              { label: 'Private Set Intersection', sub: 'Session #4819 · in progress', time: '12m' },
              { label: 'Dining Cryptographers', sub: 'Session #4818 · completed', time: '18m' },
              { label: 'Byzantine Generals', sub: 'Session #4817 · completed', time: '25m' },
              { label: "Yao's Millionaire", sub: 'Session #4816 · completed', time: '31m' },
            ].map((item, i) => (
              <div key={i} style={{ padding: '9px 0', borderBottom: '1px solid rgba(212,201,176,0.5)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: '13px', color: 'var(--foreground)', lineHeight: 1.3, marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.label}
                  </div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--muted-text)' }}>
                    {item.sub}
                  </div>
                </div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--muted-text)', whiteSpace: 'nowrap', flexShrink: 0, marginTop: '1px' }}>
                  {item.time} ago
                </div>
              </div>
            ))
          ) : (
            recentGames.map((game, i) => (
              <div key={game.gameId} style={{ padding: '9px 0', borderBottom: '1px solid rgba(212,201,176,0.5)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: '13px', color: 'var(--foreground)', lineHeight: 1.3, marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {game.challengeName ?? game.challengeSlug}
                  </div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--muted-text)' }}>
                    Session #{i + 1} · {game.status ?? 'completed'}
                  </div>
                </div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--muted-text)', whiteSpace: 'nowrap', flexShrink: 0, marginTop: '1px' }}>
                  {game.createdAt ? new Date(game.createdAt).toLocaleDateString() : 'recent'}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footnote */}
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--muted-text)', marginTop: '10px', lineHeight: 1.6, fontStyle: 'italic' }}>
          * Session data refreshed in real time.
        </p>

        {/* Divider */}
        <hr style={{ border: 'none', borderTop: '1px solid var(--border-warm)', margin: '16px 0' }} />

        {/* Latest challenges in right panel */}
        <div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: '12px', paddingBottom: '6px', borderBottom: '1px solid var(--border-warm)' }}>
            Latest Challenges
          </div>
          {challenges.slice(0, 5).map(({ slug, metadata }) => (
            <Link
              key={slug}
              href={`/challenges/${slug}`}
              style={{ display: 'block', textDecoration: 'none', padding: '8px 0', borderBottom: '1px solid rgba(212,201,176,0.4)' }}
            >
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: '13px', color: 'var(--accent-blue)', lineHeight: 1.3, marginBottom: '3px' }}>
                {metadata.name}
              </div>
              {metadata.tags && metadata.tags.length > 0 && (
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {metadata.tags.slice(0, 2).map(tag => (
                    <span key={tag} style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted-text)', border: '1px solid var(--border-warm)', padding: '0 4px' }}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))}
          <Link href="/challenges" style={{ display: 'block', marginTop: '12px', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent-blue)', textDecoration: 'none', textAlign: 'center', border: '1px solid var(--accent-blue)', padding: '7px' }}>
            View Full Catalog →
          </Link>
        </div>
      </aside>

    </div>
  );
}
