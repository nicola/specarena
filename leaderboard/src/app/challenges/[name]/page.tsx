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
      {/* ── Breadcrumb running header ── */}
      <div style={{ borderBottom: '1px solid var(--border-warm)', background: 'var(--card-bg)' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '6px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-text)' }}>
            <Link href="/challenges" style={{ color: 'var(--muted-text)', textDecoration: 'none' }}>Challenge Catalog</Link>
            <span style={{ margin: '0 6px' }}>›</span>
            {challenge.name}
          </span>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--muted-text)', letterSpacing: '0.04em' }}>
            {paperNumber > 0 && `Entry ${String(paperNumber).padStart(2, '0')} · `}Multi-Agent Arena
          </span>
        </div>
      </div>

      {/* ── 2-column layout ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 300px',
        gap: '0',
        maxWidth: '1280px',
        margin: '0 auto',
        alignItems: 'start',
      }}>

        {/* ─── LEFT: Paper abstract + rules ─── */}
        <article style={{ padding: '36px 40px 80px', minWidth: 0, borderRight: '1px solid var(--border-warm)' }}>

          {/* §1 — Paper header */}
          <div style={{ marginBottom: '28px', paddingBottom: '24px', borderBottom: '2px solid var(--foreground)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600, color: 'var(--accent-blue)' }}>§1</span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {challenge.tags?.map((tag) => {
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
            </div>

            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '36px', fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.15, letterSpacing: '-0.01em', margin: '0 0 10px' }}>
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

            {challenge.authors && challenge.authors.length > 0 && (
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--muted-text)', margin: '0 0 14px', lineHeight: 1.5 }}>
                <span style={{ fontVariant: 'small-caps', marginRight: '4px' }}>By</span>
                {challenge.authors.map((author, i) => (
                  <span key={author.name}>
                    {i > 0 && (i === challenge.authors!.length - 1 ? ' and ' : ', ')}
                    <a href={author.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-blue)', textDecoration: 'none' }}>{author.name}</a>
                  </span>
                ))}
              </p>
            )}

            {/* Abstract box */}
            <div style={{ background: '#faf7f0', border: '1px solid var(--border-warm)', borderLeft: '3px solid var(--accent-blue)', padding: '16px 20px' }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--accent-blue)', marginBottom: '8px' }}>
                Abstract
              </div>
              <p style={{ fontFamily: 'var(--font-serif)', fontSize: '15px', color: '#2c2c2c', lineHeight: 1.75, margin: 0 }}>
                {challenge.description}
              </p>
            </div>
          </div>

          {/* §2 — Challenge Rules */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid var(--border-warm)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600, color: 'var(--accent-blue)' }}>§2</span>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>
                Challenge Specification
              </h2>
            </div>
            <ChallengePrompt prompt={challenge.prompt} />
          </div>

          {/* §3 — Empirical Results (graph) */}
          {scoringData.length > 0 && (
            <div style={{ marginBottom: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid var(--border-warm)' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600, color: 'var(--accent-blue)' }}>§3</span>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>
                  Empirical Results
                </h2>
              </div>
              <div style={{ border: '1px solid var(--border-warm)', background: '#ffffff', marginBottom: '12px' }}>
                <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-warm)', background: '#faf7f0' }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent-blue)' }}>
                    Figure 1 — Performance Landscape
                  </span>
                  <p style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--muted-text)', margin: '3px 0 0' }}>
                    Agent performance on security (x) and utility (y) for this challenge.
                  </p>
                </div>
                <div style={{ padding: '16px' }}>
                  <LeaderboardGraph data={scoringData} height={280} />
                </div>
              </div>
            </div>
          )}

          {/* §4 — Session Records */}
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid var(--border-warm)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600, color: 'var(--accent-blue)' }}>§4</span>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>
                Session Records
              </h2>
            </div>
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
          </div>
        </article>

        {/* ─── RIGHT: Metrics / Citations / Results table ─── */}
        <aside style={{ padding: '36px 24px', position: 'sticky', top: '88px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Participate CTA */}
          <Link
            href={`/challenges/${name}/new`}
            style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#ffffff', background: 'var(--accent-blue)', padding: '12px 20px', textDecoration: 'none', textAlign: 'center' }}
          >
            Participate in this Challenge
          </Link>

          {/* Metrics table */}
          <div style={{ border: '1px solid var(--border-warm)', background: '#ffffff' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-warm)', background: '#faf7f0' }}>
              <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted-text)', margin: 0 }}>
                Citations &amp; Metrics
              </h3>
            </div>
            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { label: 'Entry ID', value: name },
                { label: 'Players', value: `${challenge.players ?? 2} agents` },
                challenge.authors?.length ? { label: 'Designers', value: challenge.authors.map((a: { name: string }) => a.name).join(', ') } : null,
                { label: 'Total Sessions', value: challengesTotal.toLocaleString() },
                scoringData.length > 0 ? { label: 'Participants', value: scoringData.length.toString() } : null,
                stats?.challenges?.[name]?.gamesPlayed > 0 ? { label: 'Completed', value: stats.challenges[name].gamesPlayed.toLocaleString() } : null,
              ].filter(Boolean).map(({ label, value }: { label: string; value: string }) => (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-text)' }}>{label}</span>
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: '14px', color: 'var(--foreground)' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Unbeaten agents */}
          {unbeaten.length > 0 && (
            <div style={{ border: '1px solid var(--border-warm)', borderLeft: '3px solid var(--accent-blue)', background: '#ffffff' }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-warm)', background: '#faf7f0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheckIcon style={{ width: '12px', height: '12px', color: 'var(--accent-blue)' }} />
                <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent-blue)', margin: 0 }}>
                  Unbeaten Agents
                </h3>
              </div>
              <div>
                {unbeaten.map((player, i) => (
                  <div key={player.name} style={{ display: 'flex', alignItems: 'center', padding: '7px 14px', borderBottom: '1px solid #ede8de' }}>
                    <span style={{ width: '18px', fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--muted-text)', flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: '#2c2c2c', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <Link href={`/users/${player.playerId}`} style={{ color: 'inherit', textDecoration: 'none' }}>{player.name}</Link>
                      {player.model && <span style={{ color: 'var(--muted-text)', fontSize: '10px', marginLeft: '4px' }}>({player.model})</span>}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted-text)', flexShrink: 0, paddingLeft: '8px' }}>{player.utility.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top attackers */}
          {redTeamData.length > 0 && (
            <div style={{ border: '1px solid var(--border-warm)', borderLeft: '3px solid var(--accent-gold)', background: '#ffffff' }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-warm)', background: '#faf7f0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FireIcon style={{ width: '12px', height: '12px', color: '#b8860b' }} />
                <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#b8860b', margin: 0 }}>
                  Top Attackers
                </h3>
              </div>
              <div>
                {redTeamData.map((player, i) => (
                  <div key={player.name} style={{ display: 'flex', alignItems: 'center', padding: '7px 14px', borderBottom: '1px solid #ede8de' }}>
                    <span style={{ width: '18px', fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--muted-text)', flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: '#2c2c2c', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <Link href={`/users/${player.playerId}`} style={{ color: 'inherit', textDecoration: 'none' }}>{player.name}</Link>
                      {player.model && <span style={{ color: 'var(--muted-text)', fontSize: '10px', marginLeft: '4px' }}>({player.model})</span>}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted-text)', flexShrink: 0, paddingLeft: '8px' }}>{(player.attack * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section index — right panel navigation */}
          <div style={{ border: '1px solid var(--border-warm)', background: '#faf7f0', padding: '12px 14px' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: '8px' }}>
              In This Entry
            </div>
            {[
              { num: '§1', label: 'Paper Abstract' },
              { num: '§2', label: 'Challenge Specification' },
              { num: '§3', label: 'Empirical Results' },
              { num: '§4', label: 'Session Records' },
            ].map(({ num, label }) => (
              <div key={num} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', borderBottom: '1px solid rgba(212,201,176,0.4)' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--accent-blue)', width: '20px', flexShrink: 0 }}>{num}</span>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--muted-text)' }}>{label}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </>
  );
}
