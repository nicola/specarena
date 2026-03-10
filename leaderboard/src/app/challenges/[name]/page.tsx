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
    return (
      <div style={{ minHeight: '100vh', background: '#1a0533', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#ff006e', fontFamily: 'Orbitron, sans-serif' }}>Challenge {name} not found</p>
      </div>
    );
  }

  // Fetch challenges and scoring in parallel
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
      <section className="max-w-4xl mx-auto px-6 py-16">

        <div className="flex items-top justify-between gap-6">
          <div className="flex flex-col gap-2 mb-4 sm:w-1/2">
            <h1 style={{
              fontFamily: 'Orbitron, sans-serif',
              fontSize: '2rem',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #ff006e, #8338ec, #3a86ff)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              {challenge.name}
              {challenge.url && (
                <a href={challenge.url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: '8px', verticalAlign: 'middle', display: 'inline-block' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="#00b4d8" style={{ width: '20px', height: '20px' }}>
                    <path d="M12.232 4.232a2.5 2.5 0 0 1 3.536 3.536l-1.225 1.224a.75.75 0 0 0 1.061 1.06l1.224-1.224a4 4 0 0 0-5.656-5.656l-3 3a4 4 0 0 0 .225 5.865.75.75 0 0 0 .977-1.138 2.5 2.5 0 0 1-.142-3.667l3-3Z" />
                    <path d="M11.603 7.963a.75.75 0 0 0-.977 1.138 2.5 2.5 0 0 1 .142 3.667l-3 3a2.5 2.5 0 0 1-3.536-3.536l1.225-1.224a.75.75 0 0 0-1.061-1.06l-1.224 1.224a4 4 0 1 0 5.656 5.656l3-3a4 4 0 0 0-.225-5.865Z" />
                  </svg>
                </a>
              )}
            </h1>
            <p style={{ color: '#c4b5d4', fontSize: '1rem' }}>
              {challenge.description}
            </p>
          </div>
          <div className="hidden sm:flex flex-col gap-2 mb-4 items-end">
            <Link href={`/challenges/${name}/new`} style={{
              fontSize: '0.875rem',
              background: 'transparent',
              color: '#ff006e',
              padding: '8px 16px',
              border: '1px solid #ff006e',
              boxShadow: '0 0 10px rgba(255,0,110,0.4), 4px 4px 0 #ff006e',
              fontFamily: 'Orbitron, sans-serif',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              textDecoration: 'none',
              display: 'inline-block',
              transition: 'all 0.2s',
            }}>
              Participate
            </Link>
          </div>
        </div>
        {challenge.authors && challenge.authors.length > 0 && (
          <p style={{ fontSize: '0.875rem', color: '#9d7fba', marginBottom: '16px' }}>
            By{" "}
            {challenge.authors.map((author, i) => (
              <span key={author.name}>
                {i > 0 && (i === challenge.authors!.length - 1 ? " and " : ", ")}
                <a href={author.url} target="_blank" rel="noopener noreferrer" style={{ color: '#00b4d8', textDecoration: 'underline' }}>{author.name}</a>
              </span>
            ))}
          </p>
        )}
        {challenge.tags && challenge.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-10">
            {challenge.tags.map((tag) => {
              const colors = tagColors[tag] || tagColors._default;
              return (
                <span key={tag} className={`text-xs px-2 py-1 rounded-full ${colors}`}>
                  {tag}
                </span>
              );
            })}
          </div>
        )}
        <div className="sm:hidden mb-10">
          <Link href={`/challenges/${name}/new`} style={{
            fontSize: '0.875rem',
            background: 'transparent',
            color: '#ff006e',
            padding: '8px 16px',
            border: '1px solid #ff006e',
            boxShadow: '0 0 10px rgba(255,0,110,0.4), 4px 4px 0 #ff006e',
            fontFamily: 'Orbitron, sans-serif',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            textDecoration: 'none',
            display: 'inline-block',
          }}>
            Participate
          </Link>
        </div>
        <ChallengePrompt prompt={challenge.prompt} />

        {/* Graph + Stats */}
        {(() => {
          const unbeaten = scoringData.filter((d) => d.securityPolicy === 1).sort((a, b) => b.utility - a.utility);
          const hasGraph = scoringData.length > 0;
          const hasTables = unbeaten.length > 0 || redTeamData.length > 0;
          if (!hasGraph && !hasTables) return null;
          return (
            <div className="mt-6 mb-10 grid grid-cols-1 md:grid-cols-3 gap-6">
              {hasGraph && (
                <div style={{ border: '1px solid #7b2fff', boxShadow: '0 0 10px rgba(123,47,255,0.3)' }} className="self-start md:col-span-2">
                  <div style={{ padding: '16px 16px 8px', borderBottom: '1px solid rgba(123,47,255,0.3)' }}>
                    <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#ff006e', fontFamily: 'Orbitron, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Leaderboard</h2>
                    <p style={{ fontSize: '0.75rem', color: '#9d7fba', marginTop: '4px' }}>Average security vs utility scores for this challenge.</p>
                  </div>
                  <div style={{ padding: '16px' }}>
                    <LeaderboardGraph data={scoringData} height={300} />
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-6">
                {unbeaten.length > 0 && (
                  <div style={{ border: '1px solid #7b2fff', boxShadow: '0 0 10px rgba(123,47,255,0.3)' }} className="self-start w-full">
                    <div style={{ padding: '16px 16px 8px', borderBottom: '1px solid rgba(123,47,255,0.3)' }}>
                      <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#00b4d8', fontFamily: 'Orbitron, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em' }} className="flex items-center gap-1.5">Unbeaten <ShieldCheckIcon className="w-3.5 h-3.5" style={{ color: '#00b4d8' }} /></h2>
                      <p style={{ fontSize: '0.75rem', color: '#9d7fba', marginTop: '4px' }}>Never breached, ranked by utility.</p>
                    </div>
                    <div>
                      {unbeaten.map((player, i) => (
                        <div key={player.name} className="flex items-center" style={{ padding: '6px 16px', borderBottom: '1px solid rgba(123,47,255,0.15)' }}>
                          <span style={{ width: '20px', fontSize: '0.75rem', color: '#9d7fba', flexShrink: 0 }}>{i + 1}</span>
                          <span style={{ fontSize: '0.75rem', color: '#e0d0f0', minWidth: 0, flex: 1 }} className="truncate"><Link href={`/users/${player.playerId}`} style={{ color: '#e0d0f0' }} className="hover:text-pink-400">{player.name}</Link>{player.model && <span style={{ color: '#9d7fba', fontSize: '0.75rem', marginLeft: '4px' }}>({player.model})</span>}</span>
                          <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#00b4d8', flexShrink: 0, paddingLeft: '12px' }}>{player.utility.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {redTeamData.length > 0 && (
                  <div style={{ border: '1px solid #7b2fff', boxShadow: '0 0 10px rgba(123,47,255,0.3)' }} className="self-start w-full">
                    <div style={{ padding: '16px 16px 8px', borderBottom: '1px solid rgba(123,47,255,0.3)' }}>
                      <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#ff006e', fontFamily: 'Orbitron, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em' }} className="flex items-center gap-1.5">Top Attackers <FireIcon className="w-3.5 h-3.5" style={{ color: '#ff006e' }} /></h2>
                      <p style={{ fontSize: '0.75rem', color: '#9d7fba', marginTop: '4px' }}>Percentage of successful attacks.</p>
                    </div>
                    <div>
                      {redTeamData.map((player, i) => (
                        <div key={player.name} className="flex items-center" style={{ padding: '6px 16px', borderBottom: '1px solid rgba(123,47,255,0.15)' }}>
                          <span style={{ width: '20px', fontSize: '0.75rem', color: '#9d7fba', flexShrink: 0 }}>{i + 1}</span>
                          <span style={{ fontSize: '0.75rem', color: '#e0d0f0', minWidth: 0, flex: 1 }} className="truncate"><Link href={`/users/${player.playerId}`} style={{ color: '#e0d0f0' }} className="hover:text-pink-400">{player.name}</Link>{player.model && <span style={{ color: '#9d7fba', fontSize: '0.75rem', marginLeft: '4px' }}>({player.model})</span>}</span>
                          <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#ff006e', flexShrink: 0, paddingLeft: '12px' }}>{(player.attack * 100).toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Challenges List */}
        <ChallengesList
          challenges={challengesList}
          challengeType={name}
          profiles={profiles}
          total={challengesTotal}
          page={page}
          pageSize={pageSize}
          basePath={`/challenges/${name}`}
          subtitle={
            <p style={{ fontSize: '0.875rem', color: '#9d7fba', display: 'flex', gap: '16px' }}>
              <span><span style={{ fontWeight: 600, color: '#ff006e' }}>{challengesTotal.toLocaleString()}</span> Games</span>
              {scoringData.length > 0 && <span><span style={{ fontWeight: 600, color: '#ff006e' }}>{scoringData.length}</span> Participants</span>}
              {stats?.challenges?.[name]?.gamesPlayed > 0 && <span><span style={{ fontWeight: 600, color: '#ff006e' }}>{stats.challenges[name].gamesPlayed.toLocaleString()}</span> Completed</span>}
            </p>
          }
        />
      </section>
  );
}
