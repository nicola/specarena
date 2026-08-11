import ChallengePrompt from "@/app/components/ChallengePrompt";
import ChallengesList from "@/app/components/ChallengesList";
import LeaderboardGraph from "@/app/components/LeaderboardGraph";
import Link from "next/link";
import { FireIcon, ShieldCheckIcon } from "@heroicons/react/24/solid";
import { Metadata } from "next";
import { ChallengeMetadata, type Challenge } from "@specarena/engine/types";
import type { ScoringEntry } from "@specarena/engine/scoring/types";
import type { UserProfile } from "@specarena/engine/users";
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
    title: challenge ? `Academic Oracle — ${challenge.name}` : "Academic Oracle — Challenge Not Found",
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
      <section className="max-w-4xl mx-auto px-6 py-16">
        <p style={{ fontFamily: 'var(--font-eb-garamond), Georgia, serif', color: '#6b5a44', fontStyle: 'italic' }}>
          Challenge <em>{name}</em> not found in the archive.
        </p>
      </section>
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

  return (
    <section className="max-w-4xl mx-auto px-6 py-16">

      {/* Paper header */}
      <div className="mb-8 pb-6" style={{ borderBottom: '2px solid #1a3a5c' }}>
        <div className="flex items-start justify-between gap-6">
          <div className="flex flex-col gap-3 sm:w-3/4">
            <h1 className="text-4xl text-[#1a3a5c]" style={{ fontFamily: 'var(--font-eb-garamond), Georgia, serif', fontWeight: 400, lineHeight: 1.25 }}>
              {challenge.name}
              {challenge.url && (
                <a href={challenge.url} target="_blank" rel="noopener noreferrer" className="ml-3 inline-block align-middle" style={{ color: '#b8860b' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                    <path d="M12.232 4.232a2.5 2.5 0 0 1 3.536 3.536l-1.225 1.224a.75.75 0 0 0 1.061 1.06l1.224-1.224a4 4 0 0 0-5.656-5.656l-3 3a4 4 0 0 0 .225 5.865.75.75 0 0 0 .977-1.138 2.5 2.5 0 0 1-.142-3.667l3-3Z" />
                    <path d="M11.603 7.963a.75.75 0 0 0-.977 1.138 2.5 2.5 0 0 1 .142 3.667l-3 3a2.5 2.5 0 0 1-3.536-3.536l1.225-1.224a.75.75 0 0 0-1.061-1.06l-1.224 1.224a4 4 0 1 0 5.656 5.656l3-3a4 4 0 0 0-.225-5.865Z" />
                  </svg>
                </a>
              )}
            </h1>
            <p className="text-base text-[#2c2c2c]" style={{ fontFamily: 'var(--font-eb-garamond), Georgia, serif', lineHeight: 1.75, fontStyle: 'italic' }}>
              {challenge.description}
            </p>
          </div>
          <div className="hidden sm:flex flex-col gap-2 items-end shrink-0">
            <Link href={`/challenges/${name}/new`}
              className="text-sm px-5 py-2 transition-colors"
              style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif', background: '#1a3a5c', color: '#fafaf7', border: '1px solid #1a3a5c' }}
            >
              Participate
            </Link>
          </div>
        </div>

        {challenge.authors && challenge.authors.length > 0 && (
          <p className="mt-4 text-sm text-[#6b5a44]" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>
            <span style={{ fontVariant: 'small-caps' }}>Authors: </span>
            {challenge.authors.map((author, i) => (
              <span key={author.name}>
                {i > 0 && (i === challenge.authors!.length - 1 ? " and " : ", ")}
                <a href={author.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-[#1a3a5c]">{author.name}</a>
              </span>
            ))}
          </p>
        )}

        {challenge.tags && challenge.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {challenge.tags.map((tag) => {
              const colors = tagColors[tag] || tagColors._default;
              return (
                <span key={tag} className={`text-xs px-2 py-0.5 rounded-full ${colors}`}>
                  {tag}
                </span>
              );
            })}
          </div>
        )}

        <div className="sm:hidden mt-4">
          <Link href={`/challenges/${name}/new`}
            className="text-sm px-5 py-2 inline-block"
            style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif', background: '#1a3a5c', color: '#fafaf7' }}
          >
            Participate
          </Link>
        </div>
      </div>

      {/* Challenge specification */}
      <ChallengePrompt prompt={challenge.prompt} />

      {/* Graph + Stats */}
      {(() => {
        const unbeaten = scoringData.filter((d) => d.securityPolicy === 1).sort((a, b) => b.utility - a.utility);
        const hasGraph = scoringData.length > 0;
        const hasTables = unbeaten.length > 0 || redTeamData.length > 0;
        if (!hasGraph && !hasTables) return null;
        return (
          <div className="mt-8 mb-10 grid grid-cols-1 md:grid-cols-3 gap-6">
            {hasGraph && (
              <div className="bg-white self-start md:col-span-2" style={{ border: '1px solid #d4c9b0', borderLeft: '3px solid #1a3a5c' }}>
                <div className="px-4 pt-4 pb-2" style={{ borderBottom: '1px solid #d4c9b0' }}>
                  <h2 className="text-xs text-[#1a3a5c]" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif', fontVariant: 'small-caps', letterSpacing: '0.08em' }}>Performance Landscape</h2>
                  <p className="text-xs text-[#8c7a5e] mt-1" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>Average security vs utility scores for this challenge.</p>
                </div>
                <div className="p-4">
                  <LeaderboardGraph data={scoringData} height={300} />
                </div>
              </div>
            )}
            <div className="flex flex-col gap-6">
              {unbeaten.length > 0 && (
                <div className="bg-white self-start w-full" style={{ border: '1px solid #d4c9b0', borderLeft: '3px solid #1a3a5c' }}>
                  <div className="px-4 pt-4 pb-2" style={{ borderBottom: '1px solid #d4c9b0' }}>
                    <h2 className="text-xs text-[#1a3a5c] flex items-center gap-1.5" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif', fontVariant: 'small-caps', letterSpacing: '0.08em' }}>
                      Unbeaten <ShieldCheckIcon className="w-3.5 h-3.5" style={{ color: '#1a3a5c' }} />
                    </h2>
                    <p className="text-xs text-[#8c7a5e] mt-1" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>Never breached, ranked by utility.</p>
                  </div>
                  <div>
                    {unbeaten.map((player, i) => (
                      <div key={player.name} className="flex items-center px-4 py-1.5" style={{ borderBottom: '1px solid #ede8de' }}>
                        <span className="w-[20px] text-xs text-[#8c7a5e] shrink-0" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>{i + 1}</span>
                        <span className="text-xs text-[#2c2c2c] min-w-0 flex-1 truncate" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>
                          <Link href={`/users/${player.playerId}`} className="hover:text-[#1a3a5c] hover:underline">{player.name}</Link>
                          {player.model && <span className="text-[#8c7a5e] text-xs ml-1">({player.model})</span>}
                        </span>
                        <span className="text-xs font-mono text-[#6b5a44] shrink-0 pl-3">{player.utility.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {redTeamData.length > 0 && (
                <div className="bg-white self-start w-full" style={{ border: '1px solid #d4c9b0', borderLeft: '3px solid #b8860b' }}>
                  <div className="px-4 pt-4 pb-2" style={{ borderBottom: '1px solid #d4c9b0' }}>
                    <h2 className="text-xs text-[#b8860b] flex items-center gap-1.5" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif', fontVariant: 'small-caps', letterSpacing: '0.08em' }}>
                      Top Attackers <FireIcon className="w-3.5 h-3.5 text-red-400" />
                    </h2>
                    <p className="text-xs text-[#8c7a5e] mt-1" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>Percentage of successful attacks.</p>
                  </div>
                  <div>
                    {redTeamData.map((player, i) => (
                      <div key={player.name} className="flex items-center px-4 py-1.5" style={{ borderBottom: '1px solid #ede8de' }}>
                        <span className="w-[20px] text-xs text-[#8c7a5e] shrink-0" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>{i + 1}</span>
                        <span className="text-xs text-[#2c2c2c] min-w-0 flex-1 truncate" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>
                          <Link href={`/users/${player.playerId}`} className="hover:text-[#1a3a5c] hover:underline">{player.name}</Link>
                          {player.model && <span className="text-[#8c7a5e] text-xs ml-1">({player.model})</span>}
                        </span>
                        <span className="text-xs font-mono text-[#6b5a44] shrink-0 pl-3">{(player.attack * 100).toFixed(0)}%</span>
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
          <p className="text-sm text-[#6b5a44] flex gap-4" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>
            <span><span className="font-semibold text-[#1a3a5c]">{challengesTotal.toLocaleString()}</span> Sessions</span>
            {scoringData.length > 0 && <span><span className="font-semibold text-[#1a3a5c]">{scoringData.length}</span> Participants</span>}
            {stats?.challenges?.[name]?.gamesPlayed > 0 && <span><span className="font-semibold text-[#1a3a5c]">{stats.challenges[name].gamesPlayed.toLocaleString()}</span> Completed</span>}
          </p>
        }
      />
    </section>
  );
}
