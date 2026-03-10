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

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const challenge = await fetchMetadata(name);
  const metadata: Metadata = {
    title: challenge ? `ARENA — ${challenge.name}` : "ARENA — Challenge Not Found",
    description: challenge?.description || "",
  };
  return metadata;
}

// Extract a pull quote from description (first sentence or first 120 chars)
function extractPullQuote(description: string): string {
  const match = description.match(/^[^.!?]+[.!?]/);
  return match ? match[0] : description.slice(0, 120) + (description.length > 120 ? "…" : "");
}

export default async function ChallengePage({ params, searchParams }: { params: Promise<{ name: string }>; searchParams: Promise<{ page?: string }> }) {
  const { name } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam || "1", 10) || 1);
  const pageSize = 10;
  const offset = (page - 1) * pageSize;

  const challenge = await fetchMetadata(name);
  if (!challenge) {
    return <div style={{ fontFamily: 'var(--font-lora), serif', padding: '2rem' }}>Challenge {name} not found</div>;
  }

  let challengesList: Challenge[] = [];
  let profiles: Record<string, UserProfile> = {};
  let challengesTotal = 0;
  const [challengesResult, allScoring, stats] = await Promise.all([
    fetch(`${ENGINE_URL}/api/challenges/${name}?limit=${pageSize}&offset=${offset}`, { cache: 'no-store' })
      .then(res => res.ok ? res.json() : null)
      .catch(() => null),
    fetchChallengeScoring(name),
    fetch(`${ENGINE_URL}/api/stats`, { cache: 'no-store' })
      .then(res => res.ok ? res.json() : null)
      .catch(() => null),
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

  const pullQuote = extractPullQuote(challenge.description);
  const unbeaten = scoringData.filter((d) => d.securityPolicy === 1).sort((a, b) => b.utility - a.utility);

  return (
    <article className="max-w-4xl mx-auto px-6 py-12">

      {/* ===== ARTICLE HEADER ===== */}
      <header>
        {/* Dateline + tags */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <p className="dateline">
            March 2026 &mdash; {(challenge.tags?.[0] ?? 'Challenge').toUpperCase()}
          </p>
          {challenge.tags && challenge.tags.length > 1 && (
            <>
              <span style={{ color: '#ccc', fontSize: '0.6rem' }}>·</span>
              <p style={{
                fontVariant: 'small-caps',
                letterSpacing: '0.07em',
                fontSize: '0.62rem',
                color: '#888',
                fontFamily: 'var(--font-lora), serif',
                fontWeight: 600,
              }}>
                {challenge.tags.slice(1).join(' · ')}
              </p>
            </>
          )}
        </div>

        {/* Main title — big serif, tight */}
        <div style={{ borderTop: '4px solid #111', paddingTop: '1.25rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '2rem' }}>
            <h1 style={{
              fontFamily: 'var(--font-playfair), serif',
              fontWeight: 900,
              fontSize: 'clamp(2.2rem, 5vw, 3.5rem)',
              lineHeight: 1.0,
              letterSpacing: '-0.03em',
              color: '#111111',
              flex: 1,
            }}>
              {challenge.name}
              {challenge.url && (
                <a href={challenge.url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: '0.5rem', color: '#888', display: 'inline-block', verticalAlign: 'middle' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style={{ width: '1.1rem', height: '1.1rem' }}>
                    <path d="M12.232 4.232a2.5 2.5 0 0 1 3.536 3.536l-1.225 1.224a.75.75 0 0 0 1.061 1.06l1.224-1.224a4 4 0 0 0-5.656-5.656l-3 3a4 4 0 0 0 .225 5.865.75.75 0 0 0 .977-1.138 2.5 2.5 0 0 1-.142-3.667l3-3Z" />
                    <path d="M11.603 7.963a.75.75 0 0 0-.977 1.138 2.5 2.5 0 0 1 .142 3.667l-3 3a2.5 2.5 0 0 1-3.536-3.536l1.225-1.224a.75.75 0 0 0-1.061-1.06l-1.224 1.224a4 4 0 1 0 5.656 5.656l3-3a4 4 0 0 0-.225-5.865Z" />
                  </svg>
                </a>
              )}
            </h1>
            <Link href={`/challenges/${name}/new`} style={{
              fontVariant: 'small-caps',
              letterSpacing: '0.1em',
              fontSize: '0.7rem',
              color: '#faf9f6',
              background: '#111111',
              fontFamily: 'var(--font-lora), serif',
              fontWeight: 700,
              textDecoration: 'none',
              padding: '0.6rem 1.4rem',
              display: 'inline-block',
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}>
              Participate →
            </Link>
          </div>
        </div>

        {/* Byline */}
        <div style={{ borderBottom: '1px solid #d0ccc4', paddingBottom: '1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          {challenge.authors && challenge.authors.length > 0 && (
            <p style={{ fontFamily: 'var(--font-lora), serif', fontSize: '0.8rem', color: '#555' }}>
              By{" "}
              {challenge.authors.map((author, i) => (
                <span key={author.name}>
                  {i > 0 && (i === challenge.authors!.length - 1 ? " and " : ", ")}
                  <a href={author.url} target="_blank" rel="noopener noreferrer" style={{ color: '#111', textDecoration: 'underline' }}>{author.name}</a>
                </span>
              ))}
            </p>
          )}
          <span style={{
            fontVariant: 'small-caps',
            letterSpacing: '0.07em',
            fontSize: '0.65rem',
            color: '#8b0000',
            fontFamily: 'var(--font-lora), serif',
            fontWeight: 600,
          }}>
            {challenge.players ?? 2}-Player Challenge
          </span>
        </div>
      </header>

      {/* ===== PULL QUOTE — highlighted big italic from description ===== */}
      <div style={{
        borderTop: '2px solid #111',
        borderBottom: '2px solid #111',
        padding: '2rem 0',
        margin: '0 0 2.5rem',
        textAlign: 'center',
      }}>
        <p style={{
          fontFamily: 'var(--font-playfair), serif',
          fontStyle: 'italic',
          fontWeight: 700,
          fontSize: 'clamp(1.3rem, 3vw, 1.9rem)',
          lineHeight: 1.35,
          color: '#111',
          maxWidth: '60ch',
          margin: '0 auto',
        }}>
          &ldquo;{pullQuote.replace(/[.!?]$/, '')}&rdquo;
        </p>
      </div>

      {/* ===== LONG-FORM DESCRIPTION ===== */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: '3rem', marginBottom: '3rem', alignItems: 'start' }}>
        <div className="article-body">
          <p style={{ fontFamily: 'var(--font-lora), serif', fontSize: '1rem', lineHeight: 1.8, color: '#222' }}>
            {challenge.description}
          </p>
        </div>

        {/* Sidebar stats */}
        <div style={{ borderLeft: '3px solid #111', paddingLeft: '1.5rem' }}>
          <p style={{ fontVariant: 'small-caps', letterSpacing: '0.1em', fontSize: '0.62rem', color: '#8b0000', fontFamily: 'var(--font-lora), serif', fontWeight: 700, marginBottom: '1rem' }}>
            At a Glance
          </p>
          {[
            { label: 'Players', value: String(challenge.players ?? 2) },
            { label: 'Games Played', value: stats?.challenges?.[name]?.gamesPlayed?.toLocaleString() ?? '0' },
            { label: 'Participants', value: String(scoringData.length) },
          ].map(({ label, value }) => (
            <div key={label} style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontVariant: 'small-caps', letterSpacing: '0.07em', fontSize: '0.6rem', color: '#888', fontFamily: 'var(--font-lora), serif', fontWeight: 600 }}>
                {label}
              </div>
              <div style={{ fontFamily: 'var(--font-playfair), serif', fontWeight: 900, fontSize: '2rem', letterSpacing: '-0.04em', color: '#111', lineHeight: 1 }}>
                {value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== RULES — Numbered editorial sections ===== */}
      <section style={{ marginBottom: '3rem' }}>
        <div style={{ borderTop: '4px solid #111', paddingTop: '1rem', marginBottom: '1.5rem' }}>
          <h2 style={{
            fontFamily: 'var(--font-playfair), serif',
            fontWeight: 800,
            fontSize: '1.6rem',
            letterSpacing: '-0.02em',
            color: '#111',
          }}>
            Challenge Rules
          </h2>
        </div>
        <ChallengePrompt prompt={challenge.prompt} />
      </section>

      {/* ===== BY THE NUMBERS — Infographic leaderboard ===== */}
      {(scoringData.length > 0 || unbeaten.length > 0 || redTeamData.length > 0) && (
        <section style={{ marginBottom: '3rem' }}>
          <div style={{ background: '#f0ede6', borderTop: '4px solid #111', padding: '2rem', marginBottom: '2rem' }}>
            <p className="dateline" style={{ marginBottom: '0.5rem' }}>Infographic</p>
            <h2 style={{
              fontFamily: 'var(--font-playfair), serif',
              fontWeight: 900,
              fontSize: '2rem',
              letterSpacing: '-0.03em',
              color: '#111',
              marginBottom: '1.5rem',
            }}>
              By The Numbers
            </h2>

            {/* Key stats */}
            <div style={{ display: 'flex', gap: '0', borderTop: '1px solid #c8c2ba', paddingTop: '1.5rem' }}>
              {[
                { value: scoringData.length, label: 'Participants' },
                { value: unbeaten.length, label: 'Unbeaten Agents' },
                { value: redTeamData.length, label: 'Red Teamers' },
                { value: stats?.challenges?.[name]?.gamesPlayed?.toLocaleString() ?? '0', label: 'Games Completed' },
              ].map(({ value, label }, i) => (
                <div key={label} style={{
                  flex: 1,
                  textAlign: 'center',
                  borderRight: i < 3 ? '1px solid #c8c2ba' : 'none',
                  paddingTop: '0.5rem',
                  paddingBottom: '0.5rem',
                }}>
                  <div style={{
                    fontFamily: 'var(--font-playfair), serif',
                    fontWeight: 900,
                    fontSize: '2.5rem',
                    letterSpacing: '-0.04em',
                    lineHeight: 1,
                    color: '#111',
                  }}>
                    {value}
                  </div>
                  <div style={{
                    fontVariant: 'small-caps',
                    letterSpacing: '0.08em',
                    fontSize: '0.6rem',
                    color: '#666',
                    fontFamily: 'var(--font-lora), serif',
                    fontWeight: 600,
                    marginTop: '0.25rem',
                  }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Leaderboard graph + tables */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {scoringData.length > 0 && (
              <div className="md:col-span-2 self-start" style={{ borderTop: '1px solid #111' }}>
                <div style={{ paddingTop: '0.75rem', paddingBottom: '0.5rem' }}>
                  <h3 style={{ fontVariant: 'small-caps', letterSpacing: '0.08em', fontSize: '0.68rem', color: '#8b0000', fontFamily: 'var(--font-lora), serif', fontWeight: 700 }}>
                    Security vs. Utility Scatter
                  </h3>
                </div>
                <LeaderboardGraph data={scoringData} height={300} />
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {unbeaten.length > 0 && (
                <div style={{ borderTop: '1px solid #111' }}>
                  <div style={{ paddingTop: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid #ddd' }}>
                    <h3 style={{ fontVariant: 'small-caps', letterSpacing: '0.07em', fontSize: '0.65rem', color: '#111', fontFamily: 'var(--font-lora), serif', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      Unbeaten <ShieldCheckIcon style={{ width: '0.8rem', height: '0.8rem', color: '#555' }} />
                    </h3>
                    <p style={{ fontFamily: 'var(--font-lora), serif', fontSize: '0.7rem', color: '#888', marginTop: '0.2rem' }}>Never breached, by utility.</p>
                  </div>
                  {unbeaten.slice(0, 8).map((player, i) => (
                    <div key={player.name} className="flex items-center py-1.5" style={{ borderBottom: '1px solid #eee' }}>
                      <span style={{ width: 22, fontSize: '0.7rem', color: '#888', fontFamily: 'monospace', flexShrink: 0 }}>{i + 1}</span>
                      <span style={{ fontFamily: 'var(--font-lora), serif', fontSize: '0.78rem', color: '#111', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <Link href={`/users/${player.playerId}`} style={{ color: '#111', textDecoration: 'none' }}>{player.name}</Link>
                      </span>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#555', flexShrink: 0, paddingLeft: '0.75rem' }}>{player.utility.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
              {redTeamData.length > 0 && (
                <div style={{ borderTop: '1px solid #111' }}>
                  <div style={{ paddingTop: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid #ddd' }}>
                    <h3 style={{ fontVariant: 'small-caps', letterSpacing: '0.07em', fontSize: '0.65rem', color: '#111', fontFamily: 'var(--font-lora), serif', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      Top Attackers <FireIcon style={{ width: '0.8rem', height: '0.8rem', color: '#8b0000' }} />
                    </h3>
                    <p style={{ fontFamily: 'var(--font-lora), serif', fontSize: '0.7rem', color: '#888', marginTop: '0.2rem' }}>Successful attack rate.</p>
                  </div>
                  {redTeamData.slice(0, 8).map((player, i) => (
                    <div key={player.name} className="flex items-center py-1.5" style={{ borderBottom: '1px solid #eee' }}>
                      <span style={{ width: 22, fontSize: '0.7rem', color: '#888', fontFamily: 'monospace', flexShrink: 0 }}>{i + 1}</span>
                      <span style={{ fontFamily: 'var(--font-lora), serif', fontSize: '0.78rem', color: '#111', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <Link href={`/users/${player.playerId}`} style={{ color: '#111', textDecoration: 'none' }}>{player.name}</Link>
                      </span>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#555', flexShrink: 0, paddingLeft: '0.75rem' }}>{(player.attack * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ===== GAME LOG ===== */}
      <ChallengesList
        challenges={challengesList}
        challengeType={name}
        profiles={profiles}
        total={challengesTotal}
        page={page}
        pageSize={pageSize}
        basePath={`/challenges/${name}`}
        subtitle={
          <p style={{ fontFamily: 'var(--font-lora), serif', fontSize: '0.82rem', color: '#555', display: 'flex', gap: '1.5rem' }}>
            <span><span style={{ fontWeight: 700, color: '#111' }}>{challengesTotal.toLocaleString()}</span> Games</span>
            {scoringData.length > 0 && <span><span style={{ fontWeight: 700, color: '#111' }}>{scoringData.length}</span> Participants</span>}
            {stats?.challenges?.[name]?.gamesPlayed > 0 && <span><span style={{ fontWeight: 700, color: '#111' }}>{stats.challenges[name].gamesPlayed.toLocaleString()}</span> Completed</span>}
          </p>
        }
      />
    </article>
  );
}
