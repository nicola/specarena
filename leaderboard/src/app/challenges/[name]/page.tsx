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
    return <div style={{ padding: 32, color: '#888' }}>Challenge {name} not found</div>;
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
    <section style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{
        paddingBottom: 16,
        borderBottom: '1px solid #e8e8e8',
        marginBottom: 24,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 16,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ width: 4, height: 20, background: '#e53935', borderRadius: 2 }} />
            <h1 style={{
              fontSize: 20,
              fontWeight: 700,
              color: '#333333',
              margin: 0,
              fontFamily: '-apple-system, "PingFang SC", sans-serif',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              {challenge.name}
              {challenge.url && (
                <a href={challenge.url} target="_blank" rel="noopener noreferrer"
                  style={{ color: '#aaa', display: 'inline-flex' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style={{ width: 16, height: 16 }}>
                    <path d="M12.232 4.232a2.5 2.5 0 0 1 3.536 3.536l-1.225 1.224a.75.75 0 0 0 1.061 1.06l1.224-1.224a4 4 0 0 0-5.656-5.656l-3 3a4 4 0 0 0 .225 5.865.75.75 0 0 0 .977-1.138 2.5 2.5 0 0 1-.142-3.667l3-3Z" />
                    <path d="M11.603 7.963a.75.75 0 0 0-.977 1.138 2.5 2.5 0 0 1 .142 3.667l-3 3a2.5 2.5 0 0 1-3.536-3.536l1.225-1.224a.75.75 0 0 0-1.061-1.06l-1.224 1.224a4 4 0 1 0 5.656 5.656l3-3a4 4 0 0 0-.225-5.865Z" />
                  </svg>
                </a>
              )}
            </h1>
          </div>
          <p style={{ fontSize: 13, color: '#666', margin: '0 0 8px 14px' }}>
            {challenge.description}
          </p>
          {challenge.authors && challenge.authors.length > 0 && (
            <p style={{ fontSize: 12, color: '#aaa', margin: '0 0 8px 14px' }}>
              By{" "}
              {challenge.authors.map((author, i) => (
                <span key={author.name}>
                  {i > 0 && (i === challenge.authors!.length - 1 ? " and " : ", ")}
                  <a href={author.url} target="_blank" rel="noopener noreferrer"
                    style={{ color: '#0052cc', textDecoration: 'underline' }}>{author.name}</a>
                </span>
              ))}
            </p>
          )}
          {challenge.tags && challenge.tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginLeft: 14 }}>
              {challenge.tags.map((tag) => {
                const colors = tagColors[tag] || tagColors._default;
                return (
                  <span key={tag} className={`text-xs px-2 py-0.5 rounded-sm ${colors}`}
                    style={{ fontSize: 10, fontWeight: 500 }}>
                    {tag}
                  </span>
                );
              })}
            </div>
          )}
        </div>
        <Link
          href={`/challenges/${name}/new`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: '#e53935',
            color: '#ffffff',
            fontSize: 13,
            fontWeight: 500,
            padding: '8px 18px',
            borderRadius: 2,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          参与挑战 Participate
        </Link>
      </div>

      {/* Prompt */}
      <div style={{ marginBottom: 24 }}>
        <ChallengePrompt prompt={challenge.prompt} />
      </div>

      {/* Graph + Stats */}
      {(() => {
        const unbeaten = scoringData.filter((d) => d.securityPolicy === 1).sort((a, b) => b.utility - a.utility);
        const hasGraph = scoringData.length > 0;
        const hasTables = unbeaten.length > 0 || redTeamData.length > 0;
        if (!hasGraph && !hasTables) return null;
        return (
          <div style={{
            display: 'grid',
            gridTemplateColumns: hasGraph ? '2fr 1fr' : '1fr',
            gap: 16,
            marginBottom: 24,
          }}>
            {hasGraph && (
              <div style={{
                background: '#ffffff',
                border: '1px solid #e8e8e8',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                borderRadius: 2,
                overflow: 'hidden',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 16px',
                  background: '#fafafa',
                  borderBottom: '1px solid #e8e8e8',
                }}>
                  <div style={{ width: 3, height: 14, background: '#e53935', borderRadius: 1 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>排行榜 Leaderboard</span>
                </div>
                <div style={{ padding: '8px 4px 4px' }}>
                  <LeaderboardGraph data={scoringData} height={300} />
                </div>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {unbeaten.length > 0 && (
                <div style={{
                  background: '#ffffff',
                  border: '1px solid #e8e8e8',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  borderRadius: 2,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    padding: '10px 16px',
                    background: '#fafafa',
                    borderBottom: '1px solid #e8e8e8',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}>
                    <ShieldCheckIcon style={{ width: 14, height: 14, color: '#0052cc' }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#333' }}>不败者 Unbeaten</span>
                  </div>
                  {unbeaten.map((player, i) => (
                    <div key={player.name} style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '8px 16px',
                      borderTop: i > 0 ? '1px solid #f5f5f5' : 'none',
                    }}>
                      <span style={{ width: 20, fontSize: 11, color: '#bbb', flexShrink: 0, fontWeight: 700 }}>{i + 1}</span>
                      <span style={{ fontSize: 12, color: '#333', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <Link href={`/users/${player.playerId}`} style={{ color: '#333', textDecoration: 'none' }}>{player.name}</Link>
                        {player.model && <span style={{ color: '#aaa', fontSize: 11, marginLeft: 4 }}>({player.model})</span>}
                      </span>
                      <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#0052cc', flexShrink: 0, paddingLeft: 12, fontWeight: 600 }}>
                        {player.utility.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {redTeamData.length > 0 && (
                <div style={{
                  background: '#ffffff',
                  border: '1px solid #e8e8e8',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  borderRadius: 2,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    padding: '10px 16px',
                    background: '#fafafa',
                    borderBottom: '1px solid #e8e8e8',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}>
                    <FireIcon style={{ width: 14, height: 14, color: '#e53935' }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#333' }}>顶级攻击者 Top Attackers</span>
                  </div>
                  {redTeamData.map((player, i) => (
                    <div key={player.name} style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '8px 16px',
                      borderTop: i > 0 ? '1px solid #f5f5f5' : 'none',
                    }}>
                      <span style={{ width: 20, fontSize: 11, color: '#bbb', flexShrink: 0, fontWeight: 700 }}>{i + 1}</span>
                      <span style={{ fontSize: 12, color: '#333', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <Link href={`/users/${player.playerId}`} style={{ color: '#333', textDecoration: 'none' }}>{player.name}</Link>
                        {player.model && <span style={{ color: '#aaa', fontSize: 11, marginLeft: 4 }}>({player.model})</span>}
                      </span>
                      <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#e53935', flexShrink: 0, paddingLeft: 12, fontWeight: 600 }}>
                        {(player.attack * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
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
          <span style={{ display: 'flex', gap: 16 }}>
            <span><span style={{ fontWeight: 700, color: '#e53935' }}>{challengesTotal.toLocaleString()}</span> <span style={{ color: '#aaa' }}>对局 Games</span></span>
            {scoringData.length > 0 && <span><span style={{ fontWeight: 700, color: '#333' }}>{scoringData.length}</span> <span style={{ color: '#aaa' }}>参赛者 Participants</span></span>}
            {stats?.challenges?.[name]?.gamesPlayed > 0 && <span><span style={{ fontWeight: 700, color: '#333' }}>{stats.challenges[name].gamesPlayed.toLocaleString()}</span> <span style={{ color: '#aaa' }}>完成 Completed</span></span>}
          </span>
        }
      />
    </section>
  );
}
