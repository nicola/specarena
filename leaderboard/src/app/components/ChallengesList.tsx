"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { UserProfile } from "@arena/engine/users";
import { ChallengeStatus, type Challenge } from "@arena/engine/types";

const amber = '#ffb000';
const amberDim = '#cc8800';
const amberBright = '#ffcc44';
const bg = '#0d0a00';

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
    return { label: "ENDED", dotColor: amberDim, textColor: amberDim, animate: false };
  if (status === ChallengeStatus.Active)
    return { label: "LIVE", dotColor: amberBright, textColor: amberBright, animate: true };
  if (waitingForPlayers)
    return { label: "WAITING", dotColor: amberDim, textColor: amberDim, animate: true };
  return { label: "NOT STARTED", dotColor: amberDim, textColor: amberDim, animate: false };
};

export default function ChallengesList({ challenges, challengeType, profiles = {}, total, page = 1, pageSize = 50, basePath, subtitle }: ChallengesListProps) {
  const router = useRouter();
  const displayTotal = total ?? challenges.length;
  const totalPages = pageSize > 0 ? Math.ceil(displayTotal / pageSize) : 1;
  const hasPagination = basePath && totalPages > 1;

  const monoStyle = { fontFamily: '"Courier New", monospace' };

  return (
    <div style={{ marginTop: '3rem' }}>
      <h2 style={{
        ...monoStyle,
        fontSize: '1.2rem',
        fontWeight: 'bold',
        color: amberBright,
        textShadow: `0 0 10px ${amberBright}`,
        marginBottom: '0.5rem',
        letterSpacing: '0.05em',
      }}>
        CHALLENGES
      </h2>
      {subtitle && <div style={{ marginTop: '0.25rem', marginBottom: '1.5rem' }}>{subtitle}</div>}

      {challenges.length === 0 ? (
        <div style={{ border: `1px solid ${amber}`, padding: '2rem', textAlign: 'center', background: bg }}>
          <p style={{ ...monoStyle, fontSize: '0.85rem', color: amberDim }}>No challenges created yet. Be the first to participate!</p>
        </div>
      ) : (
        <div style={{ border: `1px solid ${amber}`, background: bg }}>
          {/* Header row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0.75rem 1.25rem',
            borderBottom: `1px solid ${amberDim}`,
            ...monoStyle,
            fontSize: '0.65rem',
            color: amberDim,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
          }}>
            <span style={{ width: '5rem', flexShrink: 0 }}>ID</span>
            <span style={{ width: '8.75rem', flexShrink: 0 }}>Status</span>
            <span style={{ width: '6.25rem', flexShrink: 0 }}>Date</span>
            <span style={{ flex: 1, minWidth: 0 }}>Player</span>
            <span style={{ width: '4.375rem', textAlign: 'right', flexShrink: 0, paddingLeft: '0.75rem' }}>Utility</span>
            <span style={{ width: '4.375rem', textAlign: 'right', flexShrink: 0, paddingLeft: '0.75rem' }}>Security</span>
            <span style={{ width: '1rem', marginLeft: '0.5rem', flexShrink: 0 }}></span>
          </div>

          {challenges.map((challengeInstance) => {
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
                  display: 'flex',
                  alignItems: 'flex-start',
                  padding: '1rem 1.25rem',
                  borderBottom: `1px solid #1a1400`,
                  cursor: 'pointer',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#1a1400'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                <span style={{ width: '5rem', ...monoStyle, fontSize: '0.78rem', color: amberDim, flexShrink: 0 }}>
                  {challengeInstance.id.slice(0, 8)}
                </span>
                <span style={{ width: '8.75rem', ...monoStyle, fontSize: '0.75rem', color: status.textColor, textShadow: `0 0 4px ${status.textColor}`, display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                  <span style={{
                    width: '0.4rem', height: '0.4rem',
                    background: status.dotColor,
                    borderRadius: '50%',
                    flexShrink: 0,
                    boxShadow: `0 0 4px ${status.dotColor}`,
                  }}></span>
                  {status.label}
                </span>
                <span style={{ width: '6.25rem', ...monoStyle, fontSize: '0.75rem', color: amberDim, flexShrink: 0 }}>
                  {formatDate(challengeInstance.createdAt)}
                </span>

                {players.length > 0 && challengeInstance.state?.scores ? (
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {players.map((p, i) => {
                      const name = profiles[p]?.username;
                      const short = p.slice(0, 8);
                      const score = challengeInstance.state?.scores?.[i];
                      const scores = challengeInstance.state?.scores;
                      const didBreach = scores?.some((s, j) => j !== i && s.security === -1);
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                          <span style={{ ...monoStyle, fontSize: '0.78rem', color: amber, textShadow: `0 0 4px ${amber}`, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <Link
                              href={`/users/${p}`}
                              onClick={(e) => e.stopPropagation()}
                              style={{ color: amber, textDecoration: 'none' }}
                            >
                              {name ?? short}{name && <span style={{ color: amberDim }}> ({short})</span>}
                            </Link>
                            {didBreach && <span style={{ color: '#ff4400', marginLeft: '0.25rem' }}>(!)</span>}
                          </span>
                          <span style={{ width: '4.375rem', textAlign: 'right', ...monoStyle, fontSize: '0.7rem', flexShrink: 0, paddingLeft: '0.75rem', color: score?.utility === -1 ? amberDim : amberDim }}>
                            {score?.utility ?? '–'}
                          </span>
                          <span style={{ width: '4.375rem', textAlign: 'right', ...monoStyle, fontSize: '0.7rem', flexShrink: 0, paddingLeft: '0.75rem', color: score?.security === -1 ? '#ff4400' : amberDim }}>
                            {score?.security ?? '–'}
                          </span>
                          <span style={{ width: '1rem', marginLeft: '0.5rem', flexShrink: 0 }}></span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <>
                    <span style={{ ...monoStyle, fontSize: '0.78rem', color: amber, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {players.map((p, i) => {
                        const name = profiles[p]?.username;
                        const short = p.slice(0, 8);
                        return (
                          <span key={i}>
                            {i > 0 && ', '}
                            <Link
                              href={`/users/${p}`}
                              onClick={(e) => e.stopPropagation()}
                              style={{ color: amber, textDecoration: 'none' }}
                            >
                              {name ?? short}{name && <span style={{ color: amberDim }}> ({short})</span>}
                            </Link>
                          </span>
                        );
                      })}
                    </span>
                    <span style={{ color: amberDim, flexShrink: 0, marginLeft: '0.5rem' }}>&gt;</span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {hasPagination && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem', ...monoStyle, fontSize: '0.78rem' }}>
          {page > 1 ? (
            <Link href={page === 2 ? basePath : `${basePath}?page=${page - 1}`} style={{ color: amber, textDecoration: 'none' }}>
              [PREVIOUS]
            </Link>
          ) : (
            <span style={{ color: amberDim, opacity: 0.4 }}>[PREVIOUS]</span>
          )}
          <span style={{ color: amberDim }}>Page {page} of {totalPages}</span>
          {page < totalPages ? (
            <Link href={`${basePath}?page=${page + 1}`} style={{ color: amber, textDecoration: 'none' }}>
              [NEXT]
            </Link>
          ) : (
            <span style={{ color: amberDim, opacity: 0.4 }}>[NEXT]</span>
          )}
        </div>
      )}
    </div>
  );
}
