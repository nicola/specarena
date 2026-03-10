import ChallengePrompt from "@/app/components/ChallengePrompt";
import ChallengesList from "@/app/components/ChallengesList";
import LeaderboardGraph from "@/app/components/LeaderboardGraph";
import RunningHeader from "@/app/components/RunningHeader";
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
    title: challenge ? `ARENA WIRE — ${challenge.name}` : "ARENA WIRE — Dispatch Not Found",
    description: challenge?.description || "",
  };
  return metadata;
}

const monoLabel = {
  fontFamily: 'var(--font-mono)',
  fontSize: '0.6rem' as const,
  letterSpacing: '0.1em',
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  color: '#555',
};

export default async function ChallengePage({ params, searchParams }: { params: Promise<{ name: string }>; searchParams: Promise<{ page?: string }> }) {
  const { name } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam || "1", 10) || 1);
  const pageSize = 10;
  const offset = (page - 1) * pageSize;

  const challenge = await fetchMetadata(name);
  if (!challenge) {
    return (
      <div style={{ fontFamily: 'var(--font-mono)', padding: '2rem', fontSize: '0.8rem', color: '#888', letterSpacing: '0.08em' }}>
        DISPATCH NOT FOUND — {name.toUpperCase()} — CHECK TRANSMISSION ID
      </div>
    );
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

  const categoryLabel = challenge.tags && challenge.tags.length > 0
    ? challenge.tags[0]
    : 'Intelligence';

  const nowStr = new Date().toLocaleString('en-US', {
    month: 'long', day: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).toUpperCase();

  return (
    <>
      <RunningHeader category={categoryLabel} pageLabel="DISPATCH" />
      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* FOR IMMEDIATE RELEASE header */}
        <div style={{
          borderTop: '4px solid #111',
          borderBottom: '1px solid #111',
          padding: '0.5rem 0',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.65rem',
            fontWeight: 700,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: '#111',
          }}>
            FOR IMMEDIATE RELEASE
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.58rem',
            color: '#888',
            letterSpacing: '0.08em',
          }}>
            ARENA WIRE — {nowStr}
          </span>
        </div>

        {/* Dateline + wire code */}
        <div className="flex items-center gap-3 mb-3">
          <span style={{
            background: '#cc0000',
            color: '#fff',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.6rem',
            fontWeight: 600,
            letterSpacing: '0.1em',
            padding: '0.15em 0.5em',
            textTransform: 'uppercase',
          }}>
            {stats?.challenges?.[name]?.gamesPlayed > 0 ? 'DEVELOPING' : 'BREAKING'}
          </span>
          {challenge.tags?.map(tag => (
            <span key={tag} style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.5rem',
              color: '#888',
              letterSpacing: '0.08em',
              border: '1px solid #ddd',
              padding: '0.1em 0.4em',
              textTransform: 'uppercase',
            }}>
              {tag}
            </span>
          ))}
        </div>

        {/* Main headline */}
        <h1 style={{
          fontFamily: 'var(--font-playfair), serif',
          fontSize: '2.6rem',
          fontWeight: '800',
          color: '#111',
          lineHeight: 1.1,
          marginBottom: '0.5rem',
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

        {/* Byline + dateline */}
        <div style={{
          borderBottom: '1px solid #111',
          paddingBottom: '0.75rem',
          marginBottom: '1.5rem',
        }}>
          {challenge.authors && challenge.authors.length > 0 && (
            <p style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.78rem',
              color: '#555',
              marginBottom: '0.25rem',
            }}>
              By{" "}
              {challenge.authors.map((author, i) => (
                <span key={author.name}>
                  {i > 0 && (i === challenge.authors!.length - 1 ? " and " : ", ")}
                  <a href={author.url} target="_blank" rel="noopener noreferrer" style={{ color: '#111', textDecoration: 'underline' }}>{author.name}</a>
                </span>
              ))}
            </p>
          )}
          <div className="flex items-center gap-4">
            <p style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6rem',
              color: '#555',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}>
              SAN FRANCISCO — {nowStr}
            </p>
            {challengesTotal > 0 && (
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.58rem',
                color: '#888',
                letterSpacing: '0.04em',
              }}>
                {challengesTotal.toLocaleString()} SESSIONS FILED
              </span>
            )}
          </div>
        </div>

        {/* Inverted pyramid lede */}
        <div className="flex gap-8 mb-8">
          <div style={{ flex: 2 }}>
            <p style={{
              fontFamily: 'var(--font-playfair), serif',
              fontSize: '1.1rem',
              fontStyle: 'italic',
              color: '#333',
              lineHeight: 1.6,
              marginBottom: '1rem',
              borderLeft: '3px solid #111',
              paddingLeft: '1rem',
            }}>
              {description_lede(challenge.description)}
            </p>
            <p style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.88rem',
              color: '#333',
              lineHeight: 1.7,
            }}>
              {description_body(challenge.description)}
            </p>
          </div>
          <div style={{ flex: 1, flexShrink: 0 }}>
            <div style={{ border: '1px solid #111', padding: '1rem' }}>
              <div style={{ ...monoLabel, color: '#cc0000', marginBottom: '0.5rem' }}>
                DISPATCH DETAILS
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div>
                  <span style={{ ...monoLabel, fontSize: '0.52rem', color: '#888', display: 'block' }}>PLAYERS</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.88rem', fontWeight: 600, color: '#111' }}>
                    {challenge.players ?? 2}-Player
                  </span>
                </div>
                {scoringData.length > 0 && (
                  <div>
                    <span style={{ ...monoLabel, fontSize: '0.52rem', color: '#888', display: 'block' }}>PARTICIPANTS</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.88rem', fontWeight: 600, color: '#111' }}>
                      {scoringData.length}
                    </span>
                  </div>
                )}
                {stats?.challenges?.[name]?.gamesPlayed > 0 && (
                  <div>
                    <span style={{ ...monoLabel, fontSize: '0.52rem', color: '#888', display: 'block' }}>SESSIONS</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.88rem', fontWeight: 600, color: '#111' }}>
                      {stats.challenges[name].gamesPlayed.toLocaleString()}
                    </span>
                  </div>
                )}
                <div style={{ borderTop: '1px solid #ddd', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                  <Link href={`/challenges/${name}/new`} style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    color: '#fff',
                    background: '#111',
                    padding: '0.4rem 0.75rem',
                    display: 'block',
                    textAlign: 'center',
                    textDecoration: 'none',
                    textTransform: 'uppercase',
                  }}>
                    PARTICIPATE →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Prompt section */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{
            borderTop: '2px solid #111',
            borderBottom: '1px solid #ddd',
            padding: '0.4rem 0',
            marginBottom: '1rem',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.62rem',
            fontWeight: 700,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: '#111',
          }}>
            CHALLENGE BRIEF — CLASSIFIED TRANSMISSION
          </div>
          <ChallengePrompt prompt={challenge.prompt} />
        </div>

        {/* Results Table */}
        {(() => {
          const unbeaten = scoringData.filter((d) => d.securityPolicy === 1).sort((a, b) => b.utility - a.utility);
          const hasGraph = scoringData.length > 0;
          const hasTables = unbeaten.length > 0 || redTeamData.length > 0;
          if (!hasGraph && !hasTables) return null;
          return (
            <div style={{ marginBottom: '2rem' }}>
              <div style={{
                borderTop: '2px solid #111',
                borderBottom: '1px solid #ddd',
                padding: '0.4rem 0',
                marginBottom: '1rem',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.62rem',
                fontWeight: 700,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: '#111',
              }}>
                RESULTS TABLE
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {hasGraph && (
                  <div className="md:col-span-2" style={{ borderTop: '1px solid #ddd', paddingTop: '0.75rem' }}>
                    <div style={{ ...monoLabel, color: '#888', marginBottom: '0.5rem' }}>
                      SECURITY vs. UTILITY — ALL AGENTS
                    </div>
                    <LeaderboardGraph data={scoringData} height={300} />
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {unbeaten.length > 0 && (
                    <div style={{ borderTop: '1px solid #ddd', paddingTop: '0.75rem' }}>
                      <div style={{ ...monoLabel, display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.4rem' }}>
                        UNBREACHED <ShieldCheckIcon style={{ width: '0.75rem', height: '0.75rem' }} />
                      </div>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.52rem', color: '#888', marginBottom: '0.5rem', letterSpacing: '0.04em' }}>
                        SECURITY = 1.0 — SORTED BY UTILITY
                      </p>
                      {unbeaten.map((player, i) => (
                        <div key={player.name} className="flex items-center py-1.5" style={{ borderBottom: '1px solid #eee' }}>
                          <span style={{ width: 20, fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#888', flexShrink: 0 }}>{i + 1}</span>
                          <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#111', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <Link href={`/users/${player.playerId}`} style={{ color: '#111', textDecoration: 'none' }}>{player.name}</Link>
                          </span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: '#555', flexShrink: 0 }}>{player.utility.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {redTeamData.length > 0 && (
                    <div style={{ borderTop: '1px solid #ddd', paddingTop: '0.75rem' }}>
                      <div style={{ ...monoLabel, display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#cc0000', marginBottom: '0.4rem' }}>
                        TOP ATTACKERS <FireIcon style={{ width: '0.75rem', height: '0.75rem' }} />
                      </div>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.52rem', color: '#888', marginBottom: '0.5rem', letterSpacing: '0.04em' }}>
                        SUCCESSFUL BREACH RATE
                      </p>
                      {redTeamData.map((player, i) => (
                        <div key={player.name} className="flex items-center py-1.5" style={{ borderBottom: '1px solid #eee' }}>
                          <span style={{ width: 20, fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#888', flexShrink: 0 }}>{i + 1}</span>
                          <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#111', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <Link href={`/users/${player.playerId}`} style={{ color: '#111', textDecoration: 'none' }}>{player.name}</Link>
                          </span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: '#cc0000', flexShrink: 0 }}>{(player.attack * 100).toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Game log */}
        <ChallengesList
          challenges={challengesList}
          challengeType={name}
          profiles={profiles}
          total={challengesTotal}
          page={page}
          pageSize={pageSize}
          basePath={`/challenges/${name}`}
          subtitle={
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: '#555', display: 'flex', gap: '1.5rem', letterSpacing: '0.06em' }}>
              <span><span style={{ fontWeight: 700, color: '#111' }}>{challengesTotal.toLocaleString()}</span> GAMES</span>
              {scoringData.length > 0 && <span><span style={{ fontWeight: 700, color: '#111' }}>{scoringData.length}</span> PARTICIPANTS</span>}
            </p>
          }
        />
      </div>
    </>
  );
}

// Inverted pyramid helpers
function description_lede(desc: string): string {
  const sentences = desc.match(/[^.!?]+[.!?]+/g) || [desc];
  return sentences[0]?.trim() ?? desc;
}

function description_body(desc: string): string {
  const sentences = desc.match(/[^.!?]+[.!?]+/g) || [];
  return sentences.slice(1).join(' ').trim() || '';
}
