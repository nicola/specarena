"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FireIcon } from "@heroicons/react/24/solid";
import type { UserProfile } from "@arena/engine/users";
import { ChallengeStatus, type Challenge } from "@arena/engine/types";

interface ChallengesListProps {
  challenges: Challenge[];
  challengeType: string;
  profiles?: Record<string, UserProfile>;
  total?: number;
  page?: number;
  pageSize?: number;
  basePath?: string;
  subtitle?: React.ReactNode;
}

const formatDate = (timestamp: number) => {
  const d = new Date(timestamp);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${mm}/${dd} ${hh}:${min}`;
};

const getGameStatus = (c: Challenge) => {
  const { status, players = [] } = c.state ?? {};
  const waitingForPlayers = status === ChallengeStatus.Open && players.length > 0 && players.length < c.invites.length;
  if (status === ChallengeStatus.Ended)
    return { label: "Ended", color: "#767676", dotColor: "#767676", animate: false };
  if (status === ChallengeStatus.Active)
    return { label: "Live", color: "#000000", dotColor: "#e30613", animate: true };
  if (waitingForPlayers)
    return { label: "Waiting", color: "#767676", dotColor: "#767676", animate: true };
  return { label: "Not Started", color: "#767676", dotColor: "#767676", animate: false };
};

const colStyle = {
  fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase" as const,
  color: "#767676",
};

export default function ChallengesList({ challenges, challengeType, profiles = {}, total, page = 1, pageSize = 50, basePath, subtitle }: ChallengesListProps) {
  const router = useRouter();
  const displayTotal = total ?? challenges.length;
  const totalPages = pageSize > 0 ? Math.ceil(displayTotal / pageSize) : 1;
  const hasPagination = basePath && totalPages > 1;

  return (
    <div style={{ marginTop: "48px" }}>
      {/* Section header */}
      <div style={{ marginBottom: "16px" }}>
        <span className="swiss-rule" style={{ display: "block", marginBottom: "12px" }} />
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <h2 style={{
            fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
            fontSize: "20px",
            fontWeight: 700,
            color: "#000000",
            margin: 0,
            letterSpacing: "-0.01em",
          }}>
            Games
          </h2>
          {subtitle && <div style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontSize: "12px", color: "#767676" }}>{subtitle}</div>}
        </div>
      </div>

      {challenges.length === 0 ? (
        <div style={{ border: "2px solid #000000", padding: "32px", textAlign: "center" }}>
          <p style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontSize: "13px", color: "#767676" }}>
            No games yet.
          </p>
        </div>
      ) : (
        <div style={{ border: "2px solid #000000" }}>
          {/* Column headers */}
          <div style={{
            display: "flex",
            alignItems: "center",
            padding: "8px 16px",
            borderBottom: "1px solid #000000",
            background: "#f8f8f8",
          }}>
            <span style={{ ...colStyle, width: "80px", flexShrink: 0 }} className="max-sm:hidden">ID</span>
            <span style={{ ...colStyle, width: "120px", flexShrink: 0 }} className="max-sm:hidden">Status</span>
            <span style={{ ...colStyle, width: "96px", flexShrink: 0 }} className="max-sm:hidden">Date</span>
            <span style={{ ...colStyle, flex: 1, minWidth: 0 }}>Player</span>
            <span style={{ ...colStyle, width: "64px", flexShrink: 0, textAlign: "right" }}>Utility</span>
            <span style={{ ...colStyle, width: "64px", flexShrink: 0, textAlign: "right", paddingLeft: "8px" }}>Security</span>
          </div>

          {challenges.map((challengeInstance, rowIndex) => {
            const status = getGameStatus(challengeInstance);
            const players = challengeInstance.state?.status === ChallengeStatus.Ended
              && challengeInstance.state.playerIdentities
              ? Object.values(challengeInstance.state.playerIdentities)
              : [];
            const challengeHref = `/challenges/${challengeType || challengeInstance.challengeType}/${challengeInstance.id}`;

            return (
              <div
                key={challengeInstance.id}
                onClick={() => router.push(challengeHref)}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  padding: "10px 16px",
                  borderBottom: rowIndex < challenges.length - 1 ? "1px solid #e8e8e8" : "none",
                  cursor: "pointer",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f8f8f8")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {/* ID */}
                <span style={{
                  width: "80px",
                  fontFamily: '"Courier New", Courier, monospace',
                  fontSize: "11px",
                  color: "#767676",
                  flexShrink: 0,
                }} className="max-sm:hidden">
                  {challengeInstance.id.slice(0, 8)}
                </span>

                {/* Status */}
                <span style={{
                  width: "120px",
                  fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                  fontSize: "11px",
                  fontWeight: 700,
                  color: status.color,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }} className="max-sm:hidden">
                  <span style={{
                    width: "6px",
                    height: "6px",
                    background: status.dotColor,
                    display: "inline-block",
                    flexShrink: 0,
                  }} />
                  {status.label}
                </span>

                {/* Date */}
                <span style={{
                  width: "96px",
                  fontFamily: '"Courier New", Courier, monospace',
                  fontSize: "11px",
                  color: "#767676",
                  flexShrink: 0,
                }} className="max-sm:hidden">
                  {formatDate(challengeInstance.createdAt)}
                </span>

                {/* Players + scores */}
                {players.length > 0 && challengeInstance.state?.scores ? (
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {players.map((p, i) => {
                      const name = profiles[p]?.username;
                      const short = p.slice(0, 8);
                      const score = challengeInstance.state?.scores?.[i];
                      const scores = challengeInstance.state?.scores;
                      const didBreach = scores?.some((s, j) => j !== i && s.security === -1);
                      return (
                        <div key={i} style={{ display: "flex", alignItems: "center", lineHeight: "1.4" }}>
                          <span style={{
                            fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                            fontSize: "12px",
                            color: "#000000",
                            flex: 1,
                            minWidth: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}>
                            <Link
                              href={`/users/${p}`}
                              onClick={(e) => e.stopPropagation()}
                              style={{ color: "#000000", textDecoration: "none" }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = "#e30613")}
                              onMouseLeave={(e) => (e.currentTarget.style.color = "#000000")}
                            >
                              {name ?? short}
                              {name && <span style={{ color: "#767676" }}> ({short})</span>}
                            </Link>
                            {didBreach && <FireIcon style={{ display: "inline", width: "12px", height: "12px", marginLeft: "4px", color: "#e30613" }} />}
                          </span>
                          <span style={{
                            width: "64px",
                            textAlign: "right",
                            fontFamily: '"Courier New", Courier, monospace',
                            fontSize: "11px",
                            color: score?.utility === -1 ? "#767676" : "#000000",
                            flexShrink: 0,
                          }}>{score?.utility ?? "–"}</span>
                          <span style={{
                            width: "64px",
                            textAlign: "right",
                            fontFamily: '"Courier New", Courier, monospace',
                            fontSize: "11px",
                            color: score?.security === -1 ? "#e30613" : "#000000",
                            flexShrink: 0,
                            paddingLeft: "8px",
                          }}>{score?.security ?? "–"}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <>
                    <span style={{
                      fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                      fontSize: "12px",
                      color: "#767676",
                      flex: 1,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}>
                      {players.map((p, i) => {
                        const name = profiles[p]?.username;
                        const short = p.slice(0, 8);
                        return (
                          <span key={i}>
                            {i > 0 && ", "}
                            <Link
                              href={`/users/${p}`}
                              onClick={(e) => e.stopPropagation()}
                              style={{ color: "#767676", textDecoration: "none" }}
                            >
                              {name ?? short}
                            </Link>
                          </span>
                        );
                      })}
                    </span>
                    <svg style={{ width: "12px", height: "12px", color: "#767676", flexShrink: 0, marginLeft: "8px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {hasPagination && (
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: "16px",
          fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}>
          {page > 1 ? (
            <Link href={page === 2 ? basePath : `${basePath}?page=${page - 1}`} style={{ color: "#000000", textDecoration: "none" }}>
              ← Previous
            </Link>
          ) : (
            <span style={{ color: "#d0d0d0" }}>← Previous</span>
          )}
          <span style={{ color: "#767676" }}>Page {page} / {totalPages}</span>
          {page < totalPages ? (
            <Link href={`${basePath}?page=${page + 1}`} style={{ color: "#000000", textDecoration: "none" }}>
              Next →
            </Link>
          ) : (
            <span style={{ color: "#d0d0d0" }}>Next →</span>
          )}
        </div>
      )}
    </div>
  );
}
