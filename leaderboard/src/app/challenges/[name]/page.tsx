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
    return <div>Challenge {name} not found</div>;
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

  const labelStyle = {
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.12em",
    textTransform: "uppercase" as const,
    color: "#767676",
  };

  return (
    <section style={{ maxWidth: "1024px", margin: "0 auto", padding: "48px 24px" }}>

      {/* Breadcrumb */}
      <div style={{ marginBottom: "24px", fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontSize: "11px", color: "#767676" }}>
        <Link href="/challenges" style={{ color: "#767676", textDecoration: "none" }}>Challenges</Link>
        <span style={{ margin: "0 8px" }}>→</span>
        <span style={{ color: "#000000", fontWeight: 700 }}>{challenge.name}</span>
      </div>

      {/* Red rule + title */}
      <div style={{ borderTop: "4px solid #e30613", paddingTop: "16px", marginBottom: "32px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "24px" }}>
          <div style={{ flex: 1 }}>
            <h1 style={{
              fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
              fontSize: "40px",
              fontWeight: 700,
              color: "#000000",
              lineHeight: 1,
              letterSpacing: "-0.02em",
              margin: "0 0 12px",
            }}>
              {challenge.name}
              {challenge.url && (
                <a href={challenge.url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: "12px", verticalAlign: "middle", display: "inline-block" }}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="#767676" style={{ width: "18px", height: "18px" }}>
                    <path d="M12.232 4.232a2.5 2.5 0 0 1 3.536 3.536l-1.225 1.224a.75.75 0 0 0 1.061 1.06l1.224-1.224a4 4 0 0 0-5.656-5.656l-3 3a4 4 0 0 0 .225 5.865.75.75 0 0 0 .977-1.138 2.5 2.5 0 0 1-.142-3.667l3-3Z" />
                    <path d="M11.603 7.963a.75.75 0 0 0-.977 1.138 2.5 2.5 0 0 1 .142 3.667l-3 3a2.5 2.5 0 0 1-3.536-3.536l1.225-1.224a.75.75 0 0 0-1.061-1.06l-1.224 1.224a4 4 0 1 0 5.656 5.656l3-3a4 4 0 0 0-.225-5.865Z" />
                  </svg>
                </a>
              )}
            </h1>

            {/* Tags */}
            {challenge.tags && challenge.tags.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "12px" }}>
                {challenge.tags.map((tag) => (
                  <span key={tag} className="swiss-tag">{tag}</span>
                ))}
              </div>
            )}

            {/* Authors */}
            {challenge.authors && challenge.authors.length > 0 && (
              <p style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontSize: "12px", color: "#767676", margin: "0 0 8px" }}>
                By{" "}
                {challenge.authors.map((author, i) => (
                  <span key={author.name}>
                    {i > 0 && (i === challenge.authors!.length - 1 ? " and " : ", ")}
                    <a href={author.url} target="_blank" rel="noopener noreferrer" style={{ color: "#000000", textDecoration: "underline" }}>{author.name}</a>
                  </span>
                ))}
              </p>
            )}

            <p style={{
              fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
              fontSize: "14px",
              color: "#767676",
              lineHeight: "1.6",
              margin: 0,
            }}>
              {challenge.description}
            </p>
          </div>

          {/* Participate button */}
          <div style={{ flexShrink: 0 }}>
            <Link href={`/challenges/${name}/new`} className="swiss-btn" style={{ whiteSpace: "nowrap" }}>
              Participate →
            </Link>
          </div>
        </div>
      </div>

      {/* Prompt */}
      <div style={{ marginBottom: "32px" }}>
        <ChallengePrompt prompt={challenge.prompt} />
      </div>

      {/* Graph + Stats */}
      {(() => {
        const unbeaten = scoringData.filter((d) => d.securityPolicy === 1).sort((a, b) => b.utility - a.utility);
        const hasGraph = scoringData.length > 0;
        const hasTables = unbeaten.length > 0 || redTeamData.length > 0;
        if (!hasGraph && !hasTables) return null;
        return (
          <div style={{ display: "grid", gridTemplateColumns: hasGraph ? "1fr 1fr 1fr" : "1fr", gap: "2px", background: "#000000", border: "2px solid #000000", marginBottom: "32px" }}>
            {hasGraph && (
              <div style={{ background: "#ffffff", gridColumn: "span 2", padding: "0" }}>
                <div style={{ padding: "16px 16px 8px", borderBottom: "1px solid #e8e8e8" }}>
                  <div style={labelStyle}>Leaderboard</div>
                  <p style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontSize: "11px", color: "#767676", margin: "4px 0 0" }}>
                    Avg. security vs utility scores for this challenge.
                  </p>
                </div>
                <div style={{ padding: "16px" }}>
                  <LeaderboardGraph data={scoringData} height={280} />
                </div>
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "2px", background: "#000000" }}>
              {unbeaten.length > 0 && (
                <div style={{ background: "#ffffff" }}>
                  <div style={{ padding: "12px 16px 8px", borderBottom: "1px solid #e8e8e8" }}>
                    <div style={{ ...labelStyle, display: "flex", alignItems: "center", gap: "6px" }}>
                      Unbeaten <ShieldCheckIcon style={{ width: "12px", height: "12px", color: "#000000" }} />
                    </div>
                    <p style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontSize: "11px", color: "#767676", margin: "4px 0 0" }}>
                      Never breached, ranked by utility.
                    </p>
                  </div>
                  <div>
                    {unbeaten.map((player, i) => (
                      <div key={player.name} style={{ display: "flex", alignItems: "center", padding: "8px 16px", borderBottom: "1px solid #f0f0f0" }}>
                        <span style={{ width: "20px", fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontSize: "10px", fontWeight: 700, color: "#e30613", flexShrink: 0 }}>{i + 1}</span>
                        <span style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontSize: "11px", color: "#000000", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <Link href={`/users/${player.playerId}`} style={{ color: "#000000", textDecoration: "none" }}>{player.name}</Link>
                          {player.model && <span style={{ color: "#767676", fontSize: "10px", marginLeft: "4px" }}>({player.model})</span>}
                        </span>
                        <span style={{ fontFamily: '"Courier New", Courier, monospace', fontSize: "11px", color: "#767676", flexShrink: 0, paddingLeft: "8px" }}>{player.utility.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {redTeamData.length > 0 && (
                <div style={{ background: "#ffffff" }}>
                  <div style={{ padding: "12px 16px 8px", borderBottom: "1px solid #e8e8e8" }}>
                    <div style={{ ...labelStyle, display: "flex", alignItems: "center", gap: "6px" }}>
                      Top Attackers <FireIcon style={{ width: "12px", height: "12px", color: "#e30613" }} />
                    </div>
                    <p style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontSize: "11px", color: "#767676", margin: "4px 0 0" }}>
                      Percentage of successful attacks.
                    </p>
                  </div>
                  <div>
                    {redTeamData.map((player, i) => (
                      <div key={player.name} style={{ display: "flex", alignItems: "center", padding: "8px 16px", borderBottom: "1px solid #f0f0f0" }}>
                        <span style={{ width: "20px", fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontSize: "10px", fontWeight: 700, color: "#e30613", flexShrink: 0 }}>{i + 1}</span>
                        <span style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontSize: "11px", color: "#000000", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <Link href={`/users/${player.playerId}`} style={{ color: "#000000", textDecoration: "none" }}>{player.name}</Link>
                          {player.model && <span style={{ color: "#767676", fontSize: "10px", marginLeft: "4px" }}>({player.model})</span>}
                        </span>
                        <span style={{ fontFamily: '"Courier New", Courier, monospace', fontSize: "11px", color: "#767676", flexShrink: 0, paddingLeft: "8px" }}>{(player.attack * 100).toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Games list */}
      <ChallengesList
        challenges={challengesList}
        challengeType={name}
        profiles={profiles}
        total={challengesTotal}
        page={page}
        pageSize={pageSize}
        basePath={`/challenges/${name}`}
        subtitle={
          <span style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontSize: "11px", color: "#767676", display: "flex", gap: "16px" }}>
            <span><strong style={{ color: "#000000" }}>{challengesTotal.toLocaleString()}</strong> Games</span>
            {scoringData.length > 0 && <span><strong style={{ color: "#000000" }}>{scoringData.length}</strong> Participants</span>}
            {stats?.challenges?.[name]?.gamesPlayed > 0 && <span><strong style={{ color: "#000000" }}>{stats.challenges[name].gamesPlayed.toLocaleString()}</strong> Completed</span>}
          </span>
        }
      />
    </section>
  );
}
