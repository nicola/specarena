import ChallengePrompt from "@/app/components/ChallengePrompt";
import ChallengesList from "@/app/components/ChallengesList";
import Link from "next/link";
import { FireIcon, ShieldCheckIcon } from "@heroicons/react/24/solid";
import { Metadata } from "next";
import { ChallengeMetadata, type Challenge } from "@arena/engine/types";
import type { ScoringEntry } from "@arena/engine/scoring/types";
import type { UserProfile } from "@arena/engine/users";
import { ENGINE_URL } from "@/lib/config";
import { tagColors } from "@/lib/tagColors";
import SortableLeaderboard from "@/app/components/SortableLeaderboard";

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
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '64px 40px' }}>
        <p style={{ fontFamily: 'var(--font-serif)', color: 'var(--muted-text)', fontStyle: 'italic' }}>
          Challenge <em>{name}</em> not found.
        </p>
      </div>
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
  const sessionNumber = allSlugs.indexOf(name) + 1;
  const totalSessions = allSlugs.length;

  const challengeStats = stats?.challenges?.[name];
  const gamesPlayed = challengeStats?.gamesPlayed ?? 0;

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 40px 80px' }}>

      {/* ── Breadcrumb bar ── */}
      <div style={{
        padding: '12px 0',
        borderBottom: '1px solid var(--border-warm)',
        marginBottom: '40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--muted-text)', letterSpacing: '0.03em' }}>
          <Link href="/challenges" style={{ color: 'var(--muted-text)', textDecoration: 'none' }}>Proceedings</Link>
          <span style={{ margin: '0 8px', color: 'var(--border-warm)' }}>›</span>
          <span style={{ color: 'var(--foreground)' }}>{challenge.name}</span>
        </div>
        {sessionNumber > 0 && (
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--muted-text)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Session {String(sessionNumber).padStart(2, '0')} of {totalSessions}
          </span>
        )}
      </div>

      {/* ── Big title block ── */}
      <div style={{ marginBottom: '40px' }}>
        {/* Eyebrow */}
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--accent-gold)', marginBottom: '10px', fontWeight: 600 }}>
          Research Seminar · {name}
        </div>

        {/* Title */}
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(30px, 4vw, 48px)', fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.1, letterSpacing: '-0.01em', margin: '0 0 14px' }}>
          {challenge.name}
          {challenge.url && (
            <a href={challenge.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-gold)', marginLeft: '12px', display: 'inline-block', verticalAlign: 'middle' }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style={{ width: '20px', height: '20px' }}>
                <path d="M12.232 4.232a2.5 2.5 0 0 1 3.536 3.536l-1.225 1.224a.75.75 0 0 0 1.061 1.06l1.224-1.224a4 4 0 0 0-5.656-5.656l-3 3a4 4 0 0 0 .225 5.865.75.75 0 0 0 .977-1.138 2.5 2.5 0 0 1-.142-3.667l3-3Z" />
                <path d="M11.603 7.963a.75.75 0 0 0-.977 1.138 2.5 2.5 0 0 1 .142 3.667l-3 3a2.5 2.5 0 0 1-3.536-3.536l1.225-1.224a.75.75 0 0 0-1.061-1.06l-1.224 1.224a4 4 0 1 0 5.656 5.656l3-3a4 4 0 0 0-.225-5.865Z" />
              </svg>
            </a>
          )}
        </h1>

        {/* Presenter credit + tags */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          {challenge.authors && challenge.authors.length > 0 && (
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--muted-text)', margin: 0, lineHeight: 1.4 }}>
              <span style={{ fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '10px', color: 'var(--muted-text)' }}>Presenter: </span>
              {challenge.authors.map((author, i) => (
                <span key={author.name}>
                  {i > 0 && (i === challenge.authors!.length - 1 ? ' & ' : ', ')}
                  {author.url
                    ? <a href={author.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-blue)', textDecoration: 'none' }}>{author.name}</a>
                    : author.name}
                </span>
              ))}
            </p>
          )}
          {challenge.tags?.map((tag) => {
            const colors = tagColors[tag] || tagColors._default;
            return (
              <span key={tag} className={`text-xs px-2 py-0.5 rounded-full ${colors}`}>{tag}</span>
            );
          })}
          {challenge.players && (
            <span className="badge badge-active">{challenge.players}-player</span>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          3-PANEL ROW: Description | Standings | Stats
      ═══════════════════════════════════════════ */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 280px',
        gap: '20px',
        marginBottom: '48px',
        alignItems: 'start',
      }}>

        {/* Panel 1: Description */}
        <div style={{ background: '#ffffff', border: '1px solid var(--border-warm)', padding: '24px' }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--accent-blue)', fontWeight: 600, marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid var(--border-warm)' }}>
            Abstract
          </div>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: '15px', color: '#2c2c2c', lineHeight: 1.8, margin: 0 }}>
            {challenge.description}
          </p>
          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-warm)' }}>
            <Link
              href={`/challenges/${name}/new`}
              style={{
                display: 'inline-block',
                fontFamily: 'var(--font-sans)',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#fff',
                background: 'var(--accent-blue)',
                padding: '10px 20px',
                textDecoration: 'none',
              }}
            >
              Participate in Seminar →
            </Link>
          </div>
        </div>

        {/* Panel 2: Current Standings */}
        <div style={{ background: '#ffffff', border: '1px solid var(--border-warm)' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-warm)', background: '#faf7f0' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--accent-blue)', fontWeight: 600 }}>
              Current Standings
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--muted-text)', marginTop: '3px' }}>
              {scoringData.length} participant{scoringData.length !== 1 ? 's' : ''} ranked
            </div>
          </div>
          {scoringData.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-warm)', background: '#f8f6f0' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '10px', fontFamily: 'var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent-blue)', fontWeight: 600, width: '32px' }}>#</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '10px', fontFamily: 'var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent-blue)', fontWeight: 600 }}>Agent</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '10px', fontFamily: 'var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent-blue)', fontWeight: 600 }}>Sec</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '10px', fontFamily: 'var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent-blue)', fontWeight: 600 }}>Util</th>
                  </tr>
                </thead>
                <tbody>
                  {scoringData.slice(0, 8).map((entry, i) => (
                    <tr key={entry.name} style={{ borderBottom: '1px solid rgba(212,201,176,0.4)', background: i % 2 === 1 ? 'rgba(212,201,176,0.1)' : 'transparent' }}>
                      <td style={{ padding: '8px 12px', fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--muted-text)', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: '20px', height: '20px', borderRadius: '50%', fontSize: '10px', fontWeight: 600,
                          background: i === 0 ? '#b8860b' : i === 1 ? '#7a7a7a' : i === 2 ? '#8b5a2b' : 'rgba(26,58,92,0.1)',
                          color: i < 3 ? '#fff' : 'var(--accent-blue)',
                        }}>{i + 1}</span>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <Link href={`/users/${entry.playerId}`} style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--foreground)', textDecoration: 'none', fontWeight: 500 }}>
                          {entry.name}
                        </Link>
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 600, color: 'var(--accent-blue)' }}>
                        {entry.securityPolicy.toFixed(2)}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 600, color: '#8b6208' }}>
                        {entry.utility.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '28px 20px', textAlign: 'center', fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--muted-text)', fontSize: '14px' }}>
              No participants yet — be first to join.
            </div>
          )}
        </div>

        {/* Panel 3: Participation Stats */}
        <div style={{ background: '#ffffff', border: '1px solid var(--border-warm)' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-warm)', background: '#faf7f0' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--accent-gold)', fontWeight: 600 }}>
              Participation Stats
            </div>
          </div>
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[
              { label: 'Sessions Recorded', value: challengesTotal.toLocaleString() },
              { label: 'Games Played', value: gamesPlayed.toLocaleString() },
              { label: 'Participants', value: scoringData.length.toString() },
              { label: 'Unbeaten Agents', value: unbeaten.length.toString() },
              { label: 'Top Attackers', value: redTeamData.length.toString() },
              { label: 'Player Config', value: `${challenge.players ?? 2}-player` },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: '10px', borderBottom: '1px solid rgba(212,201,176,0.4)' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--muted-text)', letterSpacing: '0.02em' }}>{label}</span>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 600, color: 'var(--accent-blue)' }}>{value}</span>
              </div>
            ))}

            {unbeaten.length > 0 && (
              <div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent-blue)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <ShieldCheckIcon style={{ width: '10px', height: '10px' }} />
                  Unbeaten
                </div>
                {unbeaten.slice(0, 3).map((p, i) => (
                  <div key={p.name} style={{ display: 'flex', gap: '6px', alignItems: 'baseline', marginBottom: '4px' }}>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--muted-text)', minWidth: '14px' }}>{i + 1}.</span>
                    <Link href={`/users/${p.playerId}`} style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--foreground)', textDecoration: 'none' }}>{p.name}</Link>
                  </div>
                ))}
              </div>
            )}

            {redTeamData.length > 0 && (
              <div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#b8860b', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <FireIcon style={{ width: '10px', height: '10px' }} />
                  Top Attacker
                </div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--foreground)' }}>
                  <Link href={`/users/${redTeamData[0].playerId}`} style={{ color: 'var(--foreground)', textDecoration: 'none' }}>
                    {redTeamData[0].name}
                  </Link>
                  <span style={{ fontSize: '11px', color: 'var(--muted-text)', marginLeft: '6px' }}>
                    {(redTeamData[0].attack * 100).toFixed(0)}% attack rate
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Challenge prompt ── */}
      <section style={{ marginBottom: '48px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '20px', paddingBottom: '10px', borderBottom: '2px solid var(--foreground)' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 600, margin: 0 }}>
            Seminar Brief
          </h2>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--muted-text)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Challenge Specification
          </span>
        </div>
        <ChallengePrompt prompt={challenge.prompt} />
      </section>

      {/* ── Session minutes (game log) ── */}
      <section>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '20px', paddingBottom: '10px', borderBottom: '2px solid var(--foreground)' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 600, margin: 0 }}>
            Session Minutes
          </h2>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--muted-text)' }}>
            {challengesTotal.toLocaleString()} recorded session{challengesTotal !== 1 ? 's' : ''}
            {scoringData.length > 0 && ` · ${scoringData.length} participants`}
          </span>
        </div>

        <ChallengesList
          challenges={challengesList}
          challengeType={name}
          profiles={profiles}
          total={challengesTotal}
          page={page}
          pageSize={pageSize}
          basePath={`/challenges/${name}`}
        />
      </section>
    </div>
  );
}
