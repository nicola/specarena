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
    return { label: "已结束 Ended", dotColor: '#cccccc', textColor: '#999999', animate: false };
  if (status === ChallengeStatus.Active)
    return { label: "进行中 Live", dotColor: '#e53935', textColor: '#e53935', animate: true };
  if (waitingForPlayers)
    return { label: "等待中 Waiting", dotColor: '#ff9800', textColor: '#e65100', animate: true };
  return { label: "未开始 Not Started", dotColor: '#cccccc', textColor: '#999999', animate: false };
};

const StatusDot = ({ color, animate }: { color: string; animate: boolean }) => (
  <span style={{
    display: 'inline-block',
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: color,
    flexShrink: 0,
    animation: animate ? 'pulse 1.5s ease-in-out infinite' : 'none',
  }} />
);

export default function ChallengesList({ challenges, challengeType, profiles = {}, total, page = 1, pageSize = 50, basePath, subtitle }: ChallengesListProps) {
  const router = useRouter();
  const displayTotal = total ?? challenges.length;
  const totalPages = pageSize > 0 ? Math.ceil(displayTotal / pageSize) : 1;
  const hasPagination = basePath && totalPages > 1;

  return (
    <div style={{ marginTop: 32 }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
      }}>
        <div style={{ width: 4, height: 18, background: '#e53935', borderRadius: 2 }} />
        <h2 style={{
          fontSize: 17,
          fontWeight: 700,
          color: '#333333',
          margin: 0,
          fontFamily: '-apple-system, "PingFang SC", sans-serif',
        }}>
          对局记录 <span style={{ fontSize: 13, fontWeight: 400, color: '#888' }}>Challenges</span>
        </h2>
      </div>
      {subtitle && <div style={{ marginTop: 4, marginBottom: 16, marginLeft: 12, fontSize: 13, color: '#888' }}>{subtitle}</div>}

      {challenges.length === 0 ? (
        <div style={{
          background: '#ffffff',
          border: '1px solid #e8e8e8',
          padding: '40px 24px',
          textAlign: 'center',
          borderRadius: 2,
        }}>
          <p style={{ color: '#999', fontSize: 13 }}>暂无对局记录 — No challenges yet.</p>
        </div>
      ) : (
        <div style={{
          background: '#ffffff',
          border: '1px solid #e8e8e8',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          borderRadius: 2,
          overflow: 'hidden',
        }}>
          {/* Header row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px 16px',
            background: '#fafafa',
            borderBottom: '1px solid #e8e8e8',
            fontSize: 11,
            color: '#aaaaaa',
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}>
            <span style={{ width: 80, flexShrink: 0 }}>ID</span>
            <span style={{ width: 150, flexShrink: 0 }}>状态 Status</span>
            <span style={{ width: 100, flexShrink: 0 }}>时间 Date</span>
            <span style={{ flex: 1, minWidth: 0 }}>玩家 Player</span>
            <span style={{ width: 70, textAlign: 'right', flexShrink: 0, paddingLeft: 12 }}>效用 U</span>
            <span style={{ width: 70, textAlign: 'right', flexShrink: 0, paddingLeft: 12 }}>安全 S</span>
            <span style={{ width: 16, flexShrink: 0, marginLeft: 8 }} />
          </div>

          {challenges.map((challengeInstance, idx) => {
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
                  padding: '10px 16px',
                  borderTop: idx === 0 ? 'none' : '1px solid #f0f0f0',
                  cursor: 'pointer',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#fef8f8')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {/* ID */}
                <span style={{ width: 80, flexShrink: 0, fontSize: 11, color: '#bbbbbb', fontFamily: 'monospace' }}>
                  {challengeInstance.id.slice(0, 8)}
                </span>

                {/* Status */}
                <span style={{
                  width: 150,
                  flexShrink: 0,
                  fontSize: 12,
                  color: status.textColor,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontWeight: 500,
                }}>
                  <StatusDot color={status.dotColor} animate={status.animate} />
                  {status.label}
                </span>

                {/* Date */}
                <span style={{ width: 100, flexShrink: 0, fontSize: 11, color: '#aaaaaa' }}>
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
                        <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                          <span style={{ fontSize: 12, color: '#555555', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <Link
                              href={`/users/${p}`}
                              onClick={(e) => e.stopPropagation()}
                              style={{ color: '#333', textDecoration: 'none' }}
                              onMouseEnter={e => ((e.target as HTMLElement).style.color = '#e53935')}
                              onMouseLeave={e => ((e.target as HTMLElement).style.color = '#333')}
                            >
                              {name ?? short}{name && <span style={{ color: '#aaa' }}> ({short})</span>}
                            </Link>
                            {didBreach && <FireIcon style={{ display: 'inline', width: 12, height: 12, marginLeft: 4, color: '#e53935', opacity: 0.6 }} />}
                          </span>
                          <span style={{
                            width: 70,
                            textAlign: 'right',
                            fontSize: 11,
                            fontFamily: 'monospace',
                            flexShrink: 0,
                            paddingLeft: 12,
                            color: score?.utility === -1 ? '#9c27b0' : '#aaaaaa',
                          }}>{score?.utility ?? '–'}</span>
                          <span style={{
                            width: 70,
                            textAlign: 'right',
                            fontSize: 11,
                            fontFamily: 'monospace',
                            flexShrink: 0,
                            paddingLeft: 12,
                            color: score?.security === -1 ? '#e53935' : '#aaaaaa',
                          }}>{score?.security ?? '–'}</span>
                          <span style={{ width: 16, marginLeft: 8, flexShrink: 0 }} />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <>
                    <span style={{ fontSize: 12, color: '#555', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {players.map((p, i) => {
                        const name = profiles[p]?.username;
                        const short = p.slice(0, 8);
                        return (
                          <span key={i}>
                            {i > 0 && ', '}
                            <Link href={`/users/${p}`} onClick={(e) => e.stopPropagation()} style={{ color: '#333', textDecoration: 'none' }}>
                              {name ?? short}{name && <span style={{ color: '#aaa' }}> ({short})</span>}
                            </Link>
                          </span>
                        );
                      })}
                    </span>
                    <svg style={{ width: 14, height: 14, color: '#cccccc', flexShrink: 0, marginLeft: 8 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {hasPagination && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 12,
          fontSize: 12,
          color: '#888',
        }}>
          {page > 1 ? (
            <Link href={page === 2 ? basePath : `${basePath}?page=${page - 1}`}
              style={{ color: '#e53935', textDecoration: 'none', padding: '4px 12px', border: '1px solid #e53935', borderRadius: 2 }}>
              上一页 Prev
            </Link>
          ) : (
            <span style={{ color: '#ddd', padding: '4px 12px', border: '1px solid #eee', borderRadius: 2 }}>上一页 Prev</span>
          )}
          <span style={{ color: '#888' }}>第 {page} 页 / 共 {totalPages} 页</span>
          {page < totalPages ? (
            <Link href={`${basePath}?page=${page + 1}`}
              style={{ color: '#e53935', textDecoration: 'none', padding: '4px 12px', border: '1px solid #e53935', borderRadius: 2 }}>
              下一页 Next
            </Link>
          ) : (
            <span style={{ color: '#ddd', padding: '4px 12px', border: '1px solid #eee', borderRadius: 2 }}>下一页 Next</span>
          )}
        </div>
      )}
    </div>
  );
}
