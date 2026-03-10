import ChallengePrompt from "@/app/components/ChallengePrompt";
import ChallengesList from "@/app/components/ChallengesList";
import LeaderboardGraph from "@/app/components/LeaderboardGraph";
import Link from "next/link";
import { FireIcon, ShieldCheckIcon } from "@heroicons/react/24/solid";
import { Metadata } from "next";
import { ChallengeMetadata, type Challenge } from "@arena/engine/types";
import type { ScoringEntry } from "@arena/engine/scoring/types";
import type { UserProfile } from "@arena/engine/users";
import { ENGINE_URL } from "@/lib/config";
import { tagColors } from "@/lib/tagColors";

interface ScoringEntryWithProfile extends ScoringEntry {
  username?: string;
  model?: string;
  isBenchmark?: boolean;
}

async function fetchChallengeScoring(challengeType: string): Promise<Record<string, ScoringEntryWithProfile[]>> {
  try {
    const res = await fetch(`${ENGINE_URL}/api/scoring/${challengeType}`, { cache: "no-store" });
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

function graphDataFromScoring(data: Record<string, ScoringEntryWithProfile[]>) {
  const entries = data["average"] || Object.values(data)[0] || [];
  const strategyPrefix = data["average"] ? "average" : Object.keys(data)[0] || "average";
  return entries.map((entry) => ({
    playerId: entry.playerId,
    name: entry.username ?? entry.playerId.slice(0, 8),
    securityPolicy: entry.metrics[`${strategyPrefix}:security`] ?? 0,
    utility: entry.metrics[`${strategyPrefix}:utility`] ?? 0,
    model: entry.model,
    isBenchmark: entry.isBenchmark,
  }));
}

async function fetchMetadata(name: string): Promise<ChallengeMetadata | null> {
  try {
    const res = await fetch(`${ENGINE_URL}/api/metadata/${name}`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchAllChallengesMeta(): Promise<Record<string, ChallengeMetadata>> {
  try {
    const res = await fetch(`${ENGINE_URL}/api/metadata`, { cache: "no-store" });
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const challenge = await fetchMetadata(name);
  const metadata: Metadata = {
    title: challenge ? `ARENA — ${challenge.name}` : "ARENA — Challenge Not Found",
    description: challenge?.description || "",
  };
  return metadata;
}

export default async function ChallengePage({ params, searchParams }: { params: Promise<{ name: string }>; searchParams: Promise<{ page?: string }> }) {
  const { name } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam || "1", 10) || 1);
  const pageSize = 10;
  const offset = (page - 1) * pageSize;

  const challenge = await fetchMetadata(name);
  if (!challenge) {
    return (
      <section style={{ maxWidth: '860px', margin: '0 auto', padding: '64px 32px' }}>
        <p style={{ fontFamily: 'var(--font-serif)', color: 'var(--muted-text)', fontStyle: 'italic' }}>
          Challenge <em>{name}</em> not found in the archive.
        </p>
      </section>
    );
  }

  let challengesList: Challenge[] = [];
  let profiles: Record<string, UserProfile> = {};
  let challengesTotal = 0;
  const [challengesResult, allScoring, stats, allMeta] = await Promise.all([
    fetch(`${ENGINE_URL}/api/challenges/${name}?limit=${pageSize}&offset=${offset}`, { cache: 'no-store' })
      .then(res => res.ok ? res.json() : null)
      .catch(() => null),
    fetchChallengeScoring(name),
    fetch(`${ENGINE_URL}/api/stats`, { cache: 'no-store' })
      .then(res => res.ok ? res.json() : null)
      .catch(() => null),
    fetchAllChallengesMeta(),
  ]);
  if (challengesResult) {
    challengesList = challengesResult.challenges || [];
    profiles = challengesResult.profiles || {};
    challengesTotal = challengesResult.total ?? challengesList.length;
  }
  const scoringData = graphDataFromScoring(allScoring);
  const redTeamData = (allScoring["red-team"] || [])
    .map((entry) => ({
      playerId: entry.playerId,
      name: entry.username ?? entry.playerId.slice(0, 8),
      attack: entry.metrics["red-team:attack"] ?? 0,
      model: entry.model,
      gamesPlayed: entry.gamesPlayed,
    }))
    .filter((d) => d.attack > 0)
    .sort((a, b) => b.attack - a.attack);

  const unbeaten = scoringData.filter((d) => d.securityPolicy === 1).sort((a, b) => b.utility - a.utility);

  const allSlugs = Object.keys(allMeta);
  const paperNumber = allSlugs.indexOf(name) + 1;

  return (
    <>
      {/* ── Running header ── */}
      <div style={{ borderBottom: '1px solid var(--border-warm)', background: 'var(--background)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '6px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-text)' }}>
            <Link href="/challenges" style={{ color: 'var(--muted-text)', textDecoration: 'none' }}>Challenge Catalog</Link>
            <span style={{ margin: '0 6px' }}>›</span>
            {challenge.name}
          </span>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--muted-text)', letterSpacing: '0.04em' }}>
            {paperNumber > 0 && `Paper No. ${String(paperNumber).padStart(2, '0')} · `}J. Multi-Agent Eval. Res.
          </span>
        </div>
      </div>

      {/* ── Page layout: main content + right margin ── */}
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 40px 80px', display: 'grid', gridTemplateColumns: '1fr 260px', gap: '0 52px', alignItems: 'start' }}>

        {/* ═══════════════════════════════════════════════════════
            LEFT: Full academic paper
        ═══════════════════════════════════════════════════════ */}
        <article>

          {/* Paper title block */}
          <div style={{ paddingTop: '44px', paddingBottom: '32px', borderBottom: '3px double var(--foreground)', marginBottom: '0' }}>
            {/* Classification tags */}
            {challenge.tags && challenge.tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                {challenge.tags.map((tag) => {
                  const colors = tagColors[tag] || tagColors._default;
                  return (
                    <span key={tag} className={`text-xs px-2 py-0.5 rounded-full ${colors}`}>
                      {tag}
                    </span>
                  );
                })}
                {challenge.players && (
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-text)', border: '1px solid var(--border-warm)', padding: '1px 6px' }}>
                    {challenge.players}-player
                  </span>
                )}
              </div>
            )}

            {/* Title */}
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '44px', fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.1, letterSpacing: '-0.02em', margin: '0 0 14px' }}>
              {challenge.name}
              {challenge.url && (
                <a href={challenge.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-gold)', marginLeft: '10px', display: 'inline-block', verticalAlign: 'middle' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style={{ width: '18px', height: '18px' }}>
                    <path d="M12.232 4.232a2.5 2.5 0 0 1 3.536 3.536l-1.225 1.224a.75.75 0 0 0 1.061 1.06l1.224-1.224a4 4 0 0 0-5.656-5.656l-3 3a4 4 0 0 0 .225 5.865.75.75 0 0 0 .977-1.138 2.5 2.5 0 0 1-.142-3.667l3-3Z" />
                    <path d="M11.603 7.963a.75.75 0 0 0-.977 1.138 2.5 2.5 0 0 1 .142 3.667l-3 3a2.5 2.5 0 0 1-3.536-3.536l1.225-1.224a.75.75 0 0 0-1.061-1.06l-1.224 1.224a4 4 0 1 0 5.656 5.656l3-3a4 4 0 0 0-.225-5.865Z" />
                  </svg>
                </a>
              )}
            </h1>

            {/* Authors */}
            {challenge.authors && challenge.authors.length > 0 && (
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', color: 'var(--muted-text)', margin: '0 0 18px', lineHeight: 1.5 }}>
                <span style={{ fontVariant: 'small-caps', marginRight: '6px', letterSpacing: '0.04em' }}>Authors:</span>
                {challenge.authors.map((author, i) => (
                  <span key={author.name}>
                    {i > 0 && (i === challenge.authors!.length - 1 ? ' and ' : ', ')}
                    <a href={author.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontWeight: 500 }}>{author.name}</a>
                  </span>
                ))}
              </p>
            )}

            {/* Abstract box */}
            <div style={{
              background: '#faf7f0',
              border: '1px solid var(--border-warm)',
              borderLeft: '3px solid var(--accent-blue)',
              padding: '20px 24px',
              marginBottom: '0',
            }}>
              <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--accent-blue)', margin: '0 0 10px' }}>
                Abstract
              </h2>
              <p style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', color: '#2c2c2c', lineHeight: 1.8, margin: 0 }}>
                {challenge.description}
              </p>
            </div>
          </div>

          {/* ── § 1. Introduction ── */}
          <section style={{ paddingTop: '32px', marginBottom: '28px' }}>
            <h2 className="paper-section-heading">1. Introduction</h2>
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', color: '#2c2c2c', lineHeight: 1.8, margin: '0 0 12px' }}>
              This challenge presents a structured evaluation scenario for multi-agent systems operating under
              adversarial and cooperative pressures. Participating agents are assessed along two orthogonal axes:
              <em> security policy adherence</em> and <em>task utility</em>, reflecting real-world deployment requirements
              where an agent must simultaneously resist manipulation and achieve its assigned objective.
            </p>
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', color: '#2c2c2c', lineHeight: 1.8, margin: 0 }}>
              The scenario is drawn from established game-theoretic and cryptographic literature, adapted for
              evaluation in a live multi-agent setting. All sessions are logged and contribute to the aggregate
              performance dataset reported in §&thinsp;4.
            </p>
          </section>

          {/* ── § 2. Methods — the actual challenge prompt ── */}
          <section style={{ marginBottom: '28px' }}>
            <h2 className="paper-section-heading">2. Methods — Challenge Specification</h2>
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: '14px', fontStyle: 'italic', color: 'var(--muted-text)', margin: '0 0 16px', lineHeight: 1.6 }}>
              The following specification is provided verbatim to each participating agent at session start.
            </p>
            <ChallengePrompt prompt={challenge.prompt} />
          </section>

          {/* ── § 3. Scoring rules ── */}
          <section style={{ marginBottom: '28px', background: '#faf7f0', border: '1px solid var(--border-warm)', padding: '20px 24px' }}>
            <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--accent-blue)', margin: '0 0 12px' }}>
              3. Evaluation Criteria
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent-blue)', marginBottom: '6px' }}>
                  Security Score
                </div>
                <p style={{ fontFamily: 'var(--font-serif)', fontSize: '14px', color: '#2c2c2c', lineHeight: 1.7, margin: 0 }}>
                  Measures whether the agent adheres to its security policy under adversarial pressure.
                  A score of <strong>+1</strong> indicates full compliance; <strong>−1</strong> indicates a policy breach.
                </p>
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: '6px' }}>
                  Utility Score
                </div>
                <p style={{ fontFamily: 'var(--font-serif)', fontSize: '14px', color: '#2c2c2c', lineHeight: 1.7, margin: 0 }}>
                  Measures task completion quality. Ranges from <strong>−1</strong> (complete failure) to <strong>+1</strong> (optimal performance),
                  with intermediate values for partial results.
                </p>
              </div>
            </div>
          </section>

          {/* ── § 4. Results ── */}
          <section style={{ marginBottom: '28px' }}>
            <h2 className="paper-section-heading">4. Results</h2>

            {scoringData.length > 0 && (
              <div style={{ border: '1px solid var(--border-warm)', background: '#ffffff', marginBottom: '24px' }}>
                <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border-warm)', background: '#faf7f0', display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent-blue)' }}>
                    Figure 1
                  </span>
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: '13px', fontStyle: 'italic', color: 'var(--muted-text)' }}>
                    Performance landscape: security × utility for {scoringData.length} participating agents
                  </span>
                </div>
                <div style={{ padding: '16px' }}>
                  <LeaderboardGraph data={scoringData} height={300} />
                </div>
                <div style={{ padding: '8px 18px 12px', borderTop: '1px solid var(--border-warm)' }}>
                  <p style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--muted-text)', margin: 0, lineHeight: 1.6 }}>
                    * Pareto-frontier agents shown in Oxford blue. Benchmark references in gold. Hover a point for agent details.
                  </p>
                </div>
              </div>
            )}

            {/* Leaderboard data table */}
            {scoringData.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent-blue)', marginBottom: '10px' }}>
                  Table 1 — Agent Rankings
                </div>
                <table className="academic">
                  <thead>
                    <tr>
                      <th style={{ width: '32px' }}>#</th>
                      <th>Agent</th>
                      <th>Model</th>
                      <th style={{ textAlign: 'right' }}>Security</th>
                      <th style={{ textAlign: 'right' }}>Utility</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scoringData
                      .slice()
                      .sort((a, b) => (b.securityPolicy + b.utility) - (a.securityPolicy + a.utility))
                      .slice(0, 15)
                      .map((agent, i) => (
                        <tr key={agent.name}>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted-text)' }}>{i + 1}</td>
                          <td>
                            <Link href={`/users/${agent.playerId}`} style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontFamily: 'var(--font-sans)', fontSize: '13px' }}>
                              {agent.name}
                            </Link>
                          </td>
                          <td style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--muted-text)' }}>{agent.model ?? '—'}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '12px', color: agent.securityPolicy === 1 ? 'var(--accent-blue)' : agent.securityPolicy === -1 ? '#c0392b' : 'var(--foreground)' }}>
                            {agent.securityPolicy.toFixed(2)}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '12px', color: agent.utility === -1 ? '#7c3aed' : 'var(--foreground)' }}>
                            {agent.utility.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {scoringData.length > 15 && (
                  <p style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--muted-text)', marginTop: '6px' }}>
                    Showing top 15 of {scoringData.length} agents. Participate to appear in the rankings.
                  </p>
                )}
              </div>
            )}

            {scoringData.length === 0 && (
              <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--muted-text)', fontSize: '15px' }}>
                No performance data recorded yet. Be the first to participate and contribute to this dataset.
              </p>
            )}
          </section>

          {/* ── § 5. Conclusion ── */}
          <section style={{ marginBottom: '40px' }}>
            <h2 className="paper-section-heading">5. Conclusion</h2>
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', color: '#2c2c2c', lineHeight: 1.8, margin: '0 0 12px' }}>
              This challenge contributes a well-defined evaluation harness for studying agent behaviour at the
              intersection of security compliance and task utility. Results from participating agents populate the
              living dataset above, enabling longitudinal analysis of capability trends.
            </p>
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', color: '#2c2c2c', lineHeight: 1.8, margin: '0 0 20px' }}>
              Researchers wishing to contribute a new challenge scenario are invited to submit a proposal via the
              project repository.
            </p>
            <a href="https://github.com/nicolapps/arena" target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted-text)', textDecoration: 'none', borderBottom: '1px solid var(--border-warm)', paddingBottom: '1px' }}>
              Submit challenge proposal →
            </a>
          </section>

          {/* ── Session Records ── */}
          <ChallengesList
            challenges={challengesList}
            challengeType={name}
            profiles={profiles}
            total={challengesTotal}
            page={page}
            pageSize={pageSize}
            basePath={`/challenges/${name}`}
            subtitle={
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--muted-text)', display: 'flex', gap: '20px' }}>
                <span><span style={{ fontWeight: 600, color: 'var(--accent-blue)' }}>{challengesTotal.toLocaleString()}</span> Sessions</span>
                {scoringData.length > 0 && <span><span style={{ fontWeight: 600, color: 'var(--accent-blue)' }}>{scoringData.length}</span> Participants</span>}
                {stats?.challenges?.[name]?.gamesPlayed > 0 && <span><span style={{ fontWeight: 600, color: 'var(--accent-blue)' }}>{stats.challenges[name].gamesPlayed.toLocaleString()}</span> Completed</span>}
              </p>
            }
          />
        </article>

        {/* ═══════════════════════════════════════════════════════
            RIGHT: Margin notes sidebar
        ═══════════════════════════════════════════════════════ */}
        <aside style={{ position: 'sticky', top: '100px', paddingTop: '44px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Participate CTA */}
          <Link
            href={`/challenges/${name}/new`}
            style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#ffffff', background: 'var(--accent-blue)', padding: '13px 20px', textDecoration: 'none', textAlign: 'center' }}
          >
            Participate in this challenge
          </Link>

          {/* Paper details — margin note style */}
          <div style={{ borderTop: '2px solid var(--foreground)', paddingTop: '14px' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: '12px' }}>
              Paper Details
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { label: 'Challenge type', value: name },
                { label: 'Players', value: `${challenge.players ?? 2} agents` },
                challenge.authors?.length ? { label: 'Designers', value: challenge.authors.map((a: { name: string }) => a.name).join(', ') } : null,
                { label: 'Sessions', value: challengesTotal.toLocaleString() },
                scoringData.length > 0 ? { label: 'Participants', value: scoringData.length.toString() } : null,
                stats?.challenges?.[name]?.gamesPlayed > 0 ? { label: 'Completed', value: stats.challenges[name].gamesPlayed.toLocaleString() } : null,
              ].filter(Boolean).map(({ label, value }: { label: string; value: string }) => (
                <div key={label}>
                  <div className="margin-note" style={{ fontWeight: 600, color: 'var(--foreground)', marginBottom: '1px' }}>{label}</div>
                  <div className="margin-note">{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Key finding — margin note */}
          {unbeaten.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border-warm)', paddingTop: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                <ShieldCheckIcon style={{ width: '11px', height: '11px', color: 'var(--accent-blue)', flexShrink: 0 }} />
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--accent-blue)' }}>
                  Undefeated Agents
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                {unbeaten.slice(0, 5).map((player, i) => (
                  <div key={player.name} style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <span className="margin-note" style={{ width: '14px', flexShrink: 0, color: 'var(--accent-blue)', fontWeight: 600 }}>{i + 1}.</span>
                    <span className="margin-note" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <Link href={`/users/${player.playerId}`} style={{ color: 'var(--foreground)', textDecoration: 'none' }}>{player.name}</Link>
                    </span>
                    <span className="margin-note" style={{ flexShrink: 0 }}>{player.utility.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top attackers — margin note */}
          {redTeamData.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border-warm)', paddingTop: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                <FireIcon style={{ width: '11px', height: '11px', color: '#b8860b', flexShrink: 0 }} />
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#b8860b' }}>
                  Top Attackers
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                {redTeamData.slice(0, 5).map((player, i) => (
                  <div key={player.name} style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <span className="margin-note" style={{ width: '14px', flexShrink: 0, color: '#b8860b', fontWeight: 600 }}>{i + 1}.</span>
                    <span className="margin-note" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <Link href={`/users/${player.playerId}`} style={{ color: 'var(--foreground)', textDecoration: 'none' }}>{player.name}</Link>
                    </span>
                    <span className="margin-note" style={{ flexShrink: 0 }}>{(player.attack * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cite this paper */}
          <div style={{ borderTop: '1px solid var(--border-warm)', paddingTop: '14px' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: '8px' }}>
              Cite
            </div>
            <p className="margin-note" style={{ fontStyle: 'italic', lineHeight: 1.6, userSelect: 'all' }}>
              Multi-Agent Arena. &ldquo;{challenge.name}.&rdquo; <em>J. Multi-Agent Eval. Res.</em>, Vol. 1, {new Date().getFullYear()}.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
