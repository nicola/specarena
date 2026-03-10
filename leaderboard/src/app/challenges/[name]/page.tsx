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

  // Find position of this challenge in the catalog
  const allSlugs = Object.keys(allMeta);
  const paperNumber = allSlugs.indexOf(name) + 1;

  return (
    <>
      {/* ── Running header ── */}
      <div style={{ borderBottom: '1px solid var(--border-warm)', background: 'var(--background)' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto', padding: '6px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-text)' }}>
            <Link href="/challenges" style={{ color: 'var(--muted-text)', textDecoration: 'none' }}>Challenge Catalog</Link>
            <span style={{ margin: '0 6px' }}>›</span>
            {challenge.name}
          </span>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--muted-text)', letterSpacing: '0.04em' }}>
            {paperNumber > 0 && `Paper ${String(paperNumber).padStart(2, '0')} · `}Multi-Agent Arena
          </span>
        </div>
      </div>

      {/* ── Main content: paper layout ── */}
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '0 32px 80px', display: 'grid', gridTemplateColumns: '1fr 280px', gap: '0 48px', alignItems: 'start' }}>

        {/* ─── LEFT: Paper content ─── */}
        <article>

          {/* Paper header block */}
          <div style={{ paddingTop: '40px', paddingBottom: '28px', borderBottom: '2px solid var(--foreground)', marginBottom: '32px' }}>

            {/* Classification tags */}
            {challenge.tags && challenge.tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                {challenge.tags.map((tag) => {
                  const colors = tagColors[tag] || tagColors._default;
                  return (
                    <span key={tag} className={`text-xs px-2 py-0.5 rounded-full ${colors}`}>
                      {tag}
                    </span>
                  );
                })}
                {challenge.players && (
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-text)', border: '1px solid var(--border-warm)', padding: '1px 6px', borderRadius: '0' }}>
                    {challenge.players}-player
                  </span>
                )}
              </div>
            )}

            {/* Title */}
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '40px', fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.15, letterSpacing: '-0.01em', margin: '0 0 12px' }}>
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
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--muted-text)', margin: '0 0 16px', lineHeight: 1.5 }}>
                <span style={{ fontVariant: 'small-caps', marginRight: '4px' }}>By</span>
                {challenge.authors.map((author, i) => (
                  <span key={author.name}>
                    {i > 0 && (i === challenge.authors!.length - 1 ? ' and ' : ', ')}
                    <a href={author.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-blue)', textDecoration: 'none' }}>{author.name}</a>
                  </span>
                ))}
              </p>
            )}

            {/* Abstract — the challenge description */}
            <div style={{ background: '#faf7f0', border: '1px solid var(--border-warm)', borderLeft: '3px solid var(--accent-blue)', padding: '18px 22px' }}>
              <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--accent-blue)', margin: '0 0 8px' }}>
                Abstract
              </h2>
              <p style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', color: '#2c2c2c', lineHeight: 1.75, margin: 0 }}>
                {challenge.description}
              </p>
            </div>
          </div>

          {/* Challenge specification — the main paper body */}
          <ChallengePrompt prompt={challenge.prompt} />

          {/* Performance data section */}
          {(scoringData.length > 0 || unbeaten.length > 0) && (
            <div style={{ marginTop: '40px' }}>
              <div style={{ paddingBottom: '8px', borderBottom: '2px solid var(--foreground)', marginBottom: '20px' }}>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>
                  Empirical Results
                </h2>
              </div>
              {scoringData.length > 0 && (
                <div style={{ border: '1px solid var(--border-warm)', background: '#ffffff', marginBottom: '24px' }}>
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-warm)', background: '#faf7f0' }}>
                    <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent-blue)', margin: 0 }}>
                      Figure 1 — Performance Landscape
                    </h3>
                    <p style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--muted-text)', margin: '3px 0 0' }}>
                      Agent performance on security (x) and utility (y) dimensions for this challenge.
                    </p>
                  </div>
                  <div style={{ padding: '20px' }}>
                    <LeaderboardGraph data={scoringData} height={300} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Session Records */}
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

        {/* ─── RIGHT: Sticky Sidebar ─── */}
        <aside style={{ position: 'sticky', top: '120px', paddingTop: '40px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Participate CTA */}
          <Link
            href={`/challenges/${name}/new`}
            style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#ffffff', background: 'var(--accent-blue)', padding: '12px 20px', textDecoration: 'none', textAlign: 'center' }}
          >
            Participate in this challenge
          </Link>

          {/* Challenge metadata card */}
          <div style={{ border: '1px solid var(--border-warm)', background: '#ffffff' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-warm)', background: '#faf7f0' }}>
              <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted-text)', margin: 0 }}>
                Paper Details
              </h3>
            </div>
            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { label: 'Challenge type', value: name },
                { label: 'Players', value: `${challenge.players ?? 2} agents` },
                challenge.authors?.length ? { label: 'Designers', value: challenge.authors.map((a: { name: string }) => a.name).join(', ') } : null,
                { label: 'Sessions', value: challengesTotal.toLocaleString() },
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
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-warm)', background: '#faf7f0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheckIcon style={{ width: '12px', height: '12px', color: 'var(--accent-blue)' }} />
                <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent-blue)', margin: 0 }}>
                  Unbeaten Agents
                </h3>
              </div>
              <div>
                {unbeaten.map((player, i) => (
                  <div key={player.name} style={{ display: 'flex', alignItems: 'center', padding: '7px 16px', borderBottom: '1px solid #ede8de' }}>
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
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-warm)', background: '#faf7f0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FireIcon style={{ width: '12px', height: '12px', color: '#b8860b' }} />
                <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#b8860b', margin: 0 }}>
                  Top Attackers
                </h3>
              </div>
              <div>
                {redTeamData.map((player, i) => (
                  <div key={player.name} style={{ display: 'flex', alignItems: 'center', padding: '7px 16px', borderBottom: '1px solid #ede8de' }}>
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

        </aside>
      </div>
    </>
  );
}
