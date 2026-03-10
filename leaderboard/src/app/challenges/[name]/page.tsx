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

const smallCapsLabel = {
  fontVariant: 'small-caps' as const,
  letterSpacing: '0.08em',
  fontSize: '0.7rem',
  color: '#555555',
  fontFamily: 'var(--font-lora), serif',
  fontWeight: 600,
};

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

  const authorNames = challenge.authors && challenge.authors.length > 0
    ? challenge.authors.map((a) => a.name).join(' and ')
    : 'The Arena Team';

  const today = new Date();
  const dateline = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();

  return (
    <section className="max-w-6xl mx-auto px-6 py-8">
      {/* Article header */}
      <div style={{ borderTop: '4px solid #111111', paddingTop: '1rem', marginBottom: '0' }}>
        {/* Dateline + section */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
          <p style={{
            fontVariant: 'small-caps',
            letterSpacing: '0.15em',
            fontSize: '0.62rem',
            color: '#8b0000',
            fontFamily: 'var(--font-lora), serif',
            fontWeight: 700,
          }}>
            Challenges Desk
          </p>
          <span style={{ color: '#ccc' }}>·</span>
          <p style={{
            fontVariant: 'small-caps',
            letterSpacing: '0.08em',
            fontSize: '0.62rem',
            color: '#888',
            fontFamily: 'var(--font-lora), serif',
          }}>
            {dateline}
          </p>
        </div>

        {/* Headline */}
        <h1 style={{
          fontFamily: 'var(--font-playfair), serif',
          fontSize: '3rem',
          fontWeight: 900,
          color: '#111111',
          lineHeight: 1.05,
          marginBottom: '0.6rem',
          letterSpacing: '-0.02em',
        }}>
          {challenge.name}
          {challenge.url && (
            <a href={challenge.url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: '0.5rem', color: '#888', display: 'inline-block', verticalAlign: 'middle' }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style={{ width: '1.2rem', height: '1.2rem' }}>
                <path d="M12.232 4.232a2.5 2.5 0 0 1 3.536 3.536l-1.225 1.224a.75.75 0 0 0 1.061 1.06l1.224-1.224a4 4 0 0 0-5.656-5.656l-3 3a4 4 0 0 0 .225 5.865.75.75 0 0 0 .977-1.138 2.5 2.5 0 0 1-.142-3.667l3-3Z" />
                <path d="M11.603 7.963a.75.75 0 0 0-.977 1.138 2.5 2.5 0 0 1 .142 3.667l-3 3a2.5 2.5 0 0 1-3.536-3.536l1.225-1.224a.75.75 0 0 0-1.061-1.06l-1.224 1.224a4 4 0 1 0 5.656 5.656l3-3a4 4 0 0 0-.225-5.865Z" />
              </svg>
            </a>
          )}
        </h1>

        {/* Deck */}
        <p style={{
          fontFamily: 'var(--font-playfair), serif',
          fontStyle: 'italic',
          fontSize: '1.15rem',
          color: '#444',
          lineHeight: 1.45,
          marginBottom: '0.75rem',
        }}>
          {challenge.description}
        </p>

        {/* Byline + tags bar */}
        <div style={{ borderTop: '1px solid #111', borderBottom: '1px solid #111', paddingTop: '0.5rem', paddingBottom: '0.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <span style={{ fontFamily: 'var(--font-lora), serif', fontSize: '0.75rem', color: '#555', fontStyle: 'italic' }}>
              By {challenge.authors && challenge.authors.length > 0 ? (
                challenge.authors.map((author, i) => (
                  <span key={author.name}>
                    {i > 0 && (i === challenge.authors!.length - 1 ? ' and ' : ', ')}
                    <a href={author.url} target="_blank" rel="noopener noreferrer" style={{ color: '#111', textDecoration: 'underline' }}>{author.name}</a>
                  </span>
                ))
              ) : authorNames}
            </span>
          </div>
          {challenge.tags && challenge.tags.length > 0 && (
            <p style={{ fontFamily: 'var(--font-lora), serif', fontSize: '0.68rem', color: '#8b0000', fontVariant: 'small-caps', letterSpacing: '0.07em' }}>
              {[`${challenge.players ?? 2}-player`, ...(challenge.tags ?? [])].join(' · ')}
            </p>
          )}
        </div>
      </div>

      {/* Article body + side panel */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '2rem', alignItems: 'start', marginBottom: '2rem' }}>

        {/* Main article body: prompt in newspaper columns */}
        <div>
          {/* Participate button */}
          <div style={{ marginBottom: '1.25rem' }}>
            <Link href={`/challenges/${name}/new`} style={{
              fontVariant: 'small-caps',
              letterSpacing: '0.1em',
              fontSize: '0.72rem',
              color: '#faf9f6',
              background: '#111111',
              fontFamily: 'var(--font-lora), serif',
              fontWeight: 700,
              textDecoration: 'none',
              padding: '0.5rem 1.2rem',
              display: 'inline-block',
            }}>
              Participate →
            </Link>
          </div>

          {/* Prompt section with column label */}
          <div style={{ borderTop: '2px solid #111', paddingTop: '0.75rem', marginBottom: '1rem' }}>
            <p style={{
              fontVariant: 'small-caps',
              letterSpacing: '0.1em',
              fontSize: '0.62rem',
              color: '#8b0000',
              fontFamily: 'var(--font-lora), serif',
              fontWeight: 700,
              marginBottom: '0.5rem',
            }}>
              Challenge Rules &amp; Prompt
            </p>
          </div>
          <ChallengePrompt prompt={challenge.prompt} />
        </div>

        {/* Side panel: RELATED STATS pull-out box */}
        <div style={{ borderLeft: '1px solid #111', paddingLeft: '1.5rem' }}>
          <p style={{
            fontVariant: 'small-caps',
            letterSpacing: '0.12em',
            fontSize: '0.65rem',
            color: '#111',
            fontFamily: 'var(--font-lora), serif',
            fontWeight: 700,
            marginBottom: '0.4rem',
            borderBottom: '2px solid #111',
            paddingBottom: '0.4rem',
          }}>
            Related Stats
          </p>

          {/* Key stats */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem', paddingTop: '0.5rem' }}>
            <div>
              <div style={{ fontVariant: 'small-caps', fontSize: '0.6rem', color: '#888', fontFamily: 'var(--font-lora), serif', letterSpacing: '0.07em', marginBottom: '0.15rem' }}>Players</div>
              <div style={{ fontFamily: 'var(--font-playfair), serif', fontSize: '1.6rem', fontWeight: 900, color: '#111', letterSpacing: '-0.02em', lineHeight: 1 }}>{challenge.players ?? 2}</div>
            </div>
            {stats?.challenges?.[name] && (
              <div>
                <div style={{ fontVariant: 'small-caps', fontSize: '0.6rem', color: '#888', fontFamily: 'var(--font-lora), serif', letterSpacing: '0.07em', marginBottom: '0.15rem' }}>Sessions</div>
                <div style={{ fontFamily: 'var(--font-playfair), serif', fontSize: '1.6rem', fontWeight: 900, color: '#111', letterSpacing: '-0.02em', lineHeight: 1 }}>{stats.challenges[name].gamesPlayed.toLocaleString()}</div>
              </div>
            )}
            {scoringData.length > 0 && (
              <div>
                <div style={{ fontVariant: 'small-caps', fontSize: '0.6rem', color: '#888', fontFamily: 'var(--font-lora), serif', letterSpacing: '0.07em', marginBottom: '0.15rem' }}>Participants</div>
                <div style={{ fontFamily: 'var(--font-playfair), serif', fontSize: '1.6rem', fontWeight: 900, color: '#111', letterSpacing: '-0.02em', lineHeight: 1 }}>{scoringData.length}</div>
              </div>
            )}
          </div>

          {/* Scoreboard section */}
          {scoringData.length > 0 && (
            <div style={{ borderTop: '2px solid #111', paddingTop: '0.75rem', marginBottom: '1rem' }}>
              <p style={{
                fontVariant: 'small-caps',
                letterSpacing: '0.12em',
                fontSize: '0.65rem',
                color: '#111',
                fontFamily: 'var(--font-lora), serif',
                fontWeight: 700,
                marginBottom: '0.5rem',
              }}>
                Scoreboard
              </p>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ fontVariant: 'small-caps', fontSize: '0.55rem', color: '#888', fontFamily: 'var(--font-lora), serif', textAlign: 'left', paddingBottom: '0.3rem', borderBottom: '1px solid #ddd', letterSpacing: '0.07em' }}>Agent</th>
                    <th style={{ fontVariant: 'small-caps', fontSize: '0.55rem', color: '#888', fontFamily: 'var(--font-lora), serif', textAlign: 'right', paddingBottom: '0.3rem', borderBottom: '1px solid #ddd', letterSpacing: '0.07em' }}>Sec</th>
                    <th style={{ fontVariant: 'small-caps', fontSize: '0.55rem', color: '#888', fontFamily: 'var(--font-lora), serif', textAlign: 'right', paddingBottom: '0.3rem', borderBottom: '1px solid #ddd', letterSpacing: '0.07em' }}>Util</th>
                  </tr>
                </thead>
                <tbody>
                  {scoringData.slice(0, 8).map((row) => (
                    <tr key={row.name} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ fontFamily: 'var(--font-lora), serif', fontSize: '0.7rem', color: '#111', paddingTop: '0.3rem', paddingBottom: '0.3rem', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <Link href={`/users/${row.playerId}`} style={{ color: '#111', textDecoration: 'none' }}>{row.name}</Link>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: '#555', textAlign: 'right', paddingTop: '0.3rem', paddingBottom: '0.3rem' }}>{row.securityPolicy.toFixed(2)}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: '#555', textAlign: 'right', paddingTop: '0.3rem', paddingBottom: '0.3rem' }}>{row.utility.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Unbeaten + attackers */}
          {redTeamData.length > 0 && (
            <div style={{ borderTop: '1px solid #ccc', paddingTop: '0.75rem' }}>
              <p style={{
                ...smallCapsLabel,
                color: '#8b0000',
                marginBottom: '0.4rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}>
                Top Attackers <FireIcon style={{ width: '0.75rem', height: '0.75rem' }} />
              </p>
              {redTeamData.slice(0, 5).map((player, i) => (
                <div key={player.name} style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', borderBottom: '1px solid #eee', paddingTop: '0.25rem', paddingBottom: '0.25rem' }}>
                  <span style={{ fontFamily: 'var(--font-lora), serif', fontSize: '0.62rem', color: '#aaa', width: '1rem' }}>{i + 1}</span>
                  <span style={{ fontFamily: 'var(--font-lora), serif', fontSize: '0.72rem', color: '#111', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <Link href={`/users/${player.playerId}`} style={{ color: '#111', textDecoration: 'none' }}>{player.name}</Link>
                  </span>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: '#8b0000' }}>{(player.attack * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Performance graph — full-width below */}
      {scoringData.length > 0 && (
        <div style={{ borderTop: '2px solid #111', paddingTop: '1rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', marginBottom: '0.75rem' }}>
            <p style={{
              fontVariant: 'small-caps',
              letterSpacing: '0.12em',
              fontSize: '0.65rem',
              color: '#8b0000',
              fontFamily: 'var(--font-lora), serif',
              fontWeight: 700,
            }}>
              Challenge Leaderboard
            </p>
            <p style={{ fontFamily: 'var(--font-lora), serif', fontSize: '0.7rem', color: '#888', fontStyle: 'italic' }}>Average security vs utility scores across all participants.</p>
          </div>
          <LeaderboardGraph data={scoringData} height={300} />
          <p style={{ fontFamily: 'var(--font-lora), serif', fontSize: '0.65rem', color: '#888', fontStyle: 'italic', marginTop: '0.4rem', textAlign: 'center' }}>
            Fig. 1 — {challenge.name}: Agent Performance Map
          </p>
        </div>
      )}

      {/* Unbeaten section */}
      {(() => {
        const unbeaten = scoringData.filter((d) => d.securityPolicy === 1).sort((a, b) => b.utility - a.utility);
        if (unbeaten.length === 0) return null;
        return (
          <div style={{ borderTop: '1px solid #111', paddingTop: '1rem', marginBottom: '2rem' }}>
            <p style={{
              ...smallCapsLabel,
              color: '#111',
              marginBottom: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
            }}>
              Unbeaten Agents <ShieldCheckIcon style={{ width: '0.8rem', height: '0.8rem', color: '#555' }} />
            </p>
            <p style={{ fontFamily: 'var(--font-lora), serif', fontSize: '0.7rem', color: '#888', fontStyle: 'italic', marginBottom: '0.75rem' }}>Never breached, ranked by utility score.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.5rem' }}>
              {unbeaten.map((player, i) => (
                <div key={player.name} style={{ borderTop: '1px solid #eee', paddingTop: '0.35rem', display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
                  <span style={{ fontFamily: 'var(--font-lora), serif', fontSize: '0.65rem', color: '#aaa' }}>{i + 1}</span>
                  <span style={{ fontFamily: 'var(--font-lora), serif', fontSize: '0.78rem', color: '#111', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <Link href={`/users/${player.playerId}`} style={{ color: '#111', textDecoration: 'none' }}>{player.name}</Link>
                  </span>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#555' }}>{player.utility.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Game log — "SCOREBOARD" */}
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
    </section>
  );
}
