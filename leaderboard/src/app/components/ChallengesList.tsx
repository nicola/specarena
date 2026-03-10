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
  const { status, players = [], playerIdentities } = c.state ?? {};
  const waitingForPlayers = status === ChallengeStatus.Open && players.length > 0 && players.length < c.invites.length;
  if (status === ChallengeStatus.Ended)
    return { label: "Ended", dotColor: "#9d7fba", textColor: "#9d7fba", animate: false };
  if (status === ChallengeStatus.Active)
    return { label: "Live", dotColor: "#00ff88", textColor: "#00ff88", animate: true };
  if (waitingForPlayers)
    return { label: "Waiting for players", dotColor: "#00b4d8", textColor: "#00b4d8", animate: true };
  return { label: "Not Started", dotColor: "#7b2fff", textColor: "#7b2fff", animate: false };
};

export default function ChallengesList({ challenges, challengeType, profiles = {}, total, page = 1, pageSize = 50, basePath, subtitle }: ChallengesListProps) {
  const router = useRouter();
  const displayTotal = total ?? challenges.length;
  const totalPages = pageSize > 0 ? Math.ceil(displayTotal / pageSize) : 1;
  const hasPagination = basePath && totalPages > 1;

  const tableStyle = {
    border: '1px solid #7b2fff',
    boxShadow: '0 0 15px rgba(123,47,255,0.25)',
  };

  const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 20px',
    fontSize: '0.75rem',
    color: '#9d7fba',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    borderBottom: '1px solid rgba(123,47,255,0.4)',
    background: 'rgba(123,47,255,0.1)',
  };

  const rowStyle = {
    display: 'flex',
    alignItems: 'flex-start',
    padding: '16px 20px',
    borderBottom: '1px solid rgba(123,47,255,0.15)',
    cursor: 'pointer',
    transition: 'background 0.15s',
  };

  return (
    <div style={{ marginTop: '48px' }}>
      <h2 style={{
        fontFamily: 'Orbitron, sans-serif',
        fontSize: '1.5rem',
        fontWeight: 700,
        background: 'linear-gradient(135deg, #ff006e, #8338ec, #3a86ff)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        marginBottom: '8px',
      }}>
        Challenges
      </h2>
      {subtitle && <div style={{ marginTop: '4px', marginBottom: '24px' }}>{subtitle}</div>}
      {challenges.length === 0 ? (
        <div style={{ ...tableStyle, padding: '32px', textAlign: 'center' }}>
          <p style={{ color: '#9d7fba' }}>No challenges created yet. Be the first to participate!</p>
        </div>
      ) : (
        <div style={tableStyle}>
          <div style={headerStyle}>
            <span style={{ width: '80px', flexShrink: 0 }} className="max-sm:hidden">ID</span>
            <span style={{ width: '140px', flexShrink: 0 }} className="max-sm:hidden">Status</span>
            <span style={{ width: '100px', flexShrink: 0 }} className="max-sm:hidden">Date</span>
            <span style={{ minWidth: 0, flex: 1 }}>Player</span>
            <span style={{ width: '70px', textAlign: 'right', flexShrink: 0, paddingLeft: '12px' }} className="max-sm:w-10 max-sm:pl-1">
              <span className="max-sm:hidden">Utility</span><span className="sm:hidden">U</span>
            </span>
            <span style={{ width: '70px', textAlign: 'right', flexShrink: 0, paddingLeft: '12px' }} className="max-sm:w-10 max-sm:mr-1 max-sm:pl-1">
              <span className="max-sm:hidden">Security</span><span className="sm:hidden">S</span>
            </span>
            <span style={{ width: '16px', marginLeft: '8px', flexShrink: 0 }} className="max-sm:hidden"></span>
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
                style={rowStyle}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(123,47,255,0.1)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span
                  className="sm:hidden"
                  style={{
                    width: '6px', height: '6px', marginTop: '7px', borderRadius: '50%',
                    background: status.dotColor, flexShrink: 0, marginRight: '12px',
                    ...(status.animate ? { animation: 'pulse 1.5s ease-in-out infinite' } : {}),
                  }}
                ></span>
                <span style={{ width: '80px', fontSize: '0.875rem', color: '#9d7fba', fontFamily: 'monospace', flexShrink: 0 }} className="max-sm:hidden">
                  {challengeInstance.id.slice(0, 8)}
                </span>
                <span style={{ width: '140px', fontSize: '0.875rem', color: status.textColor, display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500, flexShrink: 0 }} className="max-sm:hidden">
                  <span
                    style={{
                      width: '6px', height: '6px', borderRadius: '50%', background: status.dotColor, flexShrink: 0,
                      ...(status.animate ? { animation: 'pulse 1.5s ease-in-out infinite' } : {}),
                    }}
                  ></span>
                  {status.label}
                </span>
                <span style={{ width: '100px', fontSize: '0.875rem', color: '#9d7fba', flexShrink: 0 }} className="max-sm:hidden">
                  {formatDate(challengeInstance.createdAt)}
                </span>
                {players.length > 0 && challengeInstance.state?.scores ? (
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <span className="sm:hidden" style={{ fontSize: '0.75rem', color: '#9d7fba', fontFamily: 'monospace', display: 'block', lineHeight: 1.2, marginTop: '2px' }}>{challengeInstance.id.slice(0, 8)}</span>
                    {players.map((p, i) => {
                      const name = profiles[p]?.username;
                      const short = p.slice(0, 8);
                      const score = challengeInstance.state?.scores?.[i];
                      const scores = challengeInstance.state?.scores;
                      const didBreach = scores?.some((s, j) => j !== i && s.security === -1);
                      return (
                        <div key={i} className="flex items-center" style={{ lineHeight: 1.4 }}>
                          <span style={{ fontSize: '0.875rem', color: '#c4b5d4', minWidth: 0, flex: 1 }} className="truncate">
                            <Link
                              href={`/users/${p}`}
                              onClick={(e) => e.stopPropagation()}
                              style={{ color: '#c4b5d4', textDecoration: 'none' }}
                              onMouseEnter={e => ((e.target as HTMLElement).style.color = '#ff006e')}
                              onMouseLeave={e => ((e.target as HTMLElement).style.color = '#c4b5d4')}
                            >
                              {name ?? short}{name && <span style={{ color: '#9d7fba' }}> ({short})</span>}
                            </Link>
                            {didBreach && <FireIcon style={{ display: 'inline', width: '12px', height: '12px', marginLeft: '4px', color: '#ff006e' }} />}
                          </span>
                          <span style={{ width: '70px', textAlign: 'right', fontSize: '0.75rem', fontFamily: 'monospace', flexShrink: 0, paddingLeft: '12px', color: score?.utility === -1 ? '#7b2fff' : '#9d7fba' }} className="max-sm:w-10 max-sm:pl-1">{score?.utility ?? '–'}</span>
                          <span style={{ width: '70px', textAlign: 'right', fontSize: '0.75rem', fontFamily: 'monospace', flexShrink: 0, paddingLeft: '12px', color: score?.security === -1 ? '#ff4d6d' : '#9d7fba' }} className="max-sm:w-10 max-sm:mr-1 max-sm:pl-1">{score?.security ?? '–'}</span>
                          <span style={{ width: '16px', marginLeft: '8px', flexShrink: 0 }} className="max-sm:hidden"></span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <>
                    <span style={{ fontSize: '0.875rem', color: '#c4b5d4', minWidth: 0, flex: 1 }} className="truncate">
                      <span className="sm:hidden" style={{ fontSize: '0.75rem', color: '#9d7fba', fontFamily: 'monospace', display: 'block', lineHeight: 1.2, marginTop: '2px' }}>{challengeInstance.id.slice(0, 8)}</span>
                      {players.map((p, i) => {
                        const name = profiles[p]?.username;
                        const short = p.slice(0, 8);
                        return (
                          <span key={i}>
                            {i > 0 && ', '}
                            <Link
                              href={`/users/${p}`}
                              onClick={(e) => e.stopPropagation()}
                              style={{ color: '#c4b5d4', textDecoration: 'none' }}
                            >
                              {name ?? short}{name && <span style={{ color: '#9d7fba' }}> ({short})</span>}
                            </Link>
                          </span>
                        );
                      })}
                    </span>
                    <svg style={{ width: '16px', height: '16px', color: '#7b2fff', flexShrink: 0, marginLeft: '8px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px', fontSize: '0.875rem' }}>
          {page > 1 ? (
            <Link href={page === 2 ? basePath : `${basePath}?page=${page - 1}`} style={{ color: '#00b4d8', textDecoration: 'none', fontFamily: 'Orbitron, sans-serif', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Previous
            </Link>
          ) : (
            <span style={{ color: '#4a3060', fontFamily: 'Orbitron, sans-serif', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Previous</span>
          )}
          <span style={{ color: '#9d7fba' }}>Page {page} of {totalPages}</span>
          {page < totalPages ? (
            <Link href={`${basePath}?page=${page + 1}`} style={{ color: '#00b4d8', textDecoration: 'none', fontFamily: 'Orbitron, sans-serif', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Next
            </Link>
          ) : (
            <span style={{ color: '#4a3060', fontFamily: 'Orbitron, sans-serif', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Next</span>
          )}
        </div>
      )}
    </div>
  );
}
