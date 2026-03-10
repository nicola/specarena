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

const amber = '#ffb000';
const amberDim = '#cc8800';
const amberBright = '#ffcc44';
const bg = '#0d0a00';

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
    title: challenge ? `ARENA - ${challenge.name}` : "ARENA - Challenge Not Found",
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
    return <div style={{ color: amber, fontFamily: '"Courier New", monospace', padding: '2rem' }}>Challenge {name} not found</div>;
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

  return (
    <section style={{ maxWidth: '56rem', margin: '0 auto', padding: '4rem 1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem', flex: 1 }}>
          <h1 style={{
            fontFamily: '"Courier New", monospace',
            fontSize: '1.6rem',
            fontWeight: 'bold',
            color: amberBright,
            textShadow: `0 0 12px ${amberBright}, 0 0 20px ${amber}`,
            letterSpacing: '0.05em',
            margin: 0,
          }}>
            {challenge.name}
            {challenge.url && (
              <a href={challenge.url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: '0.5rem', color: amberDim, verticalAlign: 'middle' }}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style={{ width: '1.1rem', height: '1.1rem', display: 'inline' }}>
                  <path d="M12.232 4.232a2.5 2.5 0 0 1 3.536 3.536l-1.225 1.224a.75.75 0 0 0 1.061 1.06l1.224-1.224a4 4 0 0 0-5.656-5.656l-3 3a4 4 0 0 0 .225 5.865.75.75 0 0 0 .977-1.138 2.5 2.5 0 0 1-.142-3.667l3-3Z" />
                  <path d="M11.603 7.963a.75.75 0 0 0-.977 1.138 2.5 2.5 0 0 1 .142 3.667l-3 3a2.5 2.5 0 0 1-3.536-3.536l1.225-1.224a.75.75 0 0 0-1.061-1.06l-1.224 1.224a4 4 0 1 0 5.656 5.656l3-3a4 4 0 0 0-.225-5.865Z" />
                </svg>
              </a>
            )}
          </h1>
          <p style={{
            fontFamily: '"Courier New", monospace',
            fontSize: '0.85rem',
            color: amber,
            textShadow: `0 0 6px ${amber}`,
            margin: 0,
          }}>
            {challenge.description}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
          <Link href={`/challenges/${name}/new`} style={{
            fontFamily: '"Courier New", monospace',
            fontSize: '0.78rem',
            background: amber,
            color: bg,
            padding: '0.4rem 1rem',
            border: `1px solid ${amber}`,
            textDecoration: 'none',
            textShadow: 'none',
            letterSpacing: '0.08em',
            whiteSpace: 'nowrap',
          }}>
            [PARTICIPATE]
          </Link>
        </div>
      </div>

      {challenge.authors && challenge.authors.length > 0 && (
        <p style={{ fontFamily: '"Courier New", monospace', fontSize: '0.78rem', color: amberDim, textShadow: `0 0 4px ${amberDim}`, marginBottom: '1rem' }}>
          By{" "}
          {challenge.authors.map((author, i) => (
            <span key={author.name}>
              {i > 0 && (i === challenge.authors!.length - 1 ? " and " : ", ")}
              <a href={author.url} target="_blank" rel="noopener noreferrer" style={{ color: amber, textDecoration: 'underline' }}>{author.name}</a>
            </span>
          ))}
        </p>
      )}

      {challenge.tags && challenge.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '2.5rem' }}>
          {challenge.tags.map((tag) => (
            <span key={tag} style={{
              fontFamily: '"Courier New", monospace',
              fontSize: '0.65rem',
              padding: '0.1rem 0.5rem',
              border: `1px solid ${amberDim}`,
              color: amberDim,
              textShadow: `0 0 4px ${amberDim}`,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}>
              {tag}
            </span>
          ))}
        </div>
      )}

      <ChallengePrompt prompt={challenge.prompt} />

      {/* Graph + Stats */}
      {(() => {
        const unbeaten = scoringData.filter((d) => d.securityPolicy === 1).sort((a, b) => b.utility - a.utility);
        const hasGraph = scoringData.length > 0;
        const hasTables = unbeaten.length > 0 || redTeamData.length > 0;
        if (!hasGraph && !hasTables) return null;
        return (
          <div style={{ marginTop: '1.5rem', marginBottom: '2.5rem', display: 'grid', gridTemplateColumns: hasTables ? '2fr 1fr' : '1fr', gap: '1.5rem' }}>
            {hasGraph && (
              <div style={{ border: `1px solid ${amber}`, background: bg }}>
                <div style={{ padding: '1rem 1rem 0.5rem', borderBottom: `1px solid ${amberDim}` }}>
                  <h2 style={{ fontFamily: '"Courier New", monospace', fontSize: '0.78rem', fontWeight: 'bold', color: amberBright, textShadow: `0 0 6px ${amberBright}`, margin: 0, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Leaderboard</h2>
                  <p style={{ fontFamily: '"Courier New", monospace', fontSize: '0.7rem', color: amberDim, textShadow: `0 0 4px ${amberDim}`, margin: '0.25rem 0 0' }}>Average security vs utility scores for this challenge.</p>
                </div>
                <div style={{ padding: '1rem' }}>
                  <LeaderboardGraph data={scoringData} height={300} />
                </div>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {unbeaten.length > 0 && (
                <div style={{ border: `1px solid ${amber}`, background: bg }}>
                  <div style={{ padding: '1rem 1rem 0.5rem', borderBottom: `1px solid ${amberDim}` }}>
                    <h2 style={{ fontFamily: '"Courier New", monospace', fontSize: '0.78rem', fontWeight: 'bold', color: amberBright, textShadow: `0 0 6px ${amberBright}`, margin: 0, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                      Unbeaten [S]
                    </h2>
                    <p style={{ fontFamily: '"Courier New", monospace', fontSize: '0.7rem', color: amberDim, margin: '0.25rem 0 0' }}>Never breached, ranked by utility.</p>
                  </div>
                  <div>
                    {unbeaten.map((player, i) => (
                      <div key={player.name} style={{ display: 'flex', alignItems: 'center', padding: '0.4rem 1rem', borderBottom: `1px solid #1a1400` }}>
                        <span style={{ width: '1.25rem', fontSize: '0.7rem', color: amberDim, flexShrink: 0 }}>{i + 1}</span>
                        <span style={{ fontFamily: '"Courier New", monospace', fontSize: '0.75rem', color: amber, textShadow: `0 0 4px ${amber}`, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <Link href={`/users/${player.playerId}`} style={{ color: amber, textDecoration: 'none' }}>{player.name}</Link>
                          {player.model && <span style={{ color: amberDim, fontSize: '0.7rem', marginLeft: '0.25rem' }}>({player.model})</span>}
                        </span>
                        <span style={{ fontFamily: '"Courier New", monospace', fontSize: '0.7rem', color: amberDim, flexShrink: 0, paddingLeft: '0.75rem' }}>{player.utility.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {redTeamData.length > 0 && (
                <div style={{ border: `1px solid ${amber}`, background: bg }}>
                  <div style={{ padding: '1rem 1rem 0.5rem', borderBottom: `1px solid ${amberDim}` }}>
                    <h2 style={{ fontFamily: '"Courier New", monospace', fontSize: '0.78rem', fontWeight: 'bold', color: amberBright, textShadow: `0 0 6px ${amberBright}`, margin: 0, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                      Top Attackers [!]
                    </h2>
                    <p style={{ fontFamily: '"Courier New", monospace', fontSize: '0.7rem', color: amberDim, margin: '0.25rem 0 0' }}>Percentage of successful attacks.</p>
                  </div>
                  <div>
                    {redTeamData.map((player, i) => (
                      <div key={player.name} style={{ display: 'flex', alignItems: 'center', padding: '0.4rem 1rem', borderBottom: `1px solid #1a1400` }}>
                        <span style={{ width: '1.25rem', fontSize: '0.7rem', color: amberDim, flexShrink: 0 }}>{i + 1}</span>
                        <span style={{ fontFamily: '"Courier New", monospace', fontSize: '0.75rem', color: amber, textShadow: `0 0 4px ${amber}`, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <Link href={`/users/${player.playerId}`} style={{ color: amber, textDecoration: 'none' }}>{player.name}</Link>
                          {player.model && <span style={{ color: amberDim, fontSize: '0.7rem', marginLeft: '0.25rem' }}>({player.model})</span>}
                        </span>
                        <span style={{ fontFamily: '"Courier New", monospace', fontSize: '0.7rem', color: amberDim, flexShrink: 0, paddingLeft: '0.75rem' }}>{(player.attack * 100).toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      <ChallengesList
        challenges={challengesList}
        challengeType={name}
        profiles={profiles}
        total={challengesTotal}
        page={page}
        pageSize={pageSize}
        basePath={`/challenges/${name}`}
        subtitle={
          <p style={{ fontFamily: '"Courier New", monospace', fontSize: '0.78rem', color: amberDim, display: 'flex', gap: '1rem' }}>
            <span><span style={{ color: amber }}>{challengesTotal.toLocaleString()}</span> Games</span>
            {scoringData.length > 0 && <span><span style={{ color: amber }}>{scoringData.length}</span> Participants</span>}
            {stats?.challenges?.[name]?.gamesPlayed > 0 && <span><span style={{ color: amber }}>{stats.challenges[name].gamesPlayed.toLocaleString()}</span> Completed</span>}
          </p>
        }
      />
    </section>
  );
}
