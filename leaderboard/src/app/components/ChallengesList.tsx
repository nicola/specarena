"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FireIcon } from "@heroicons/react/24/solid";
import type { UserProfile } from "@specarena/engine/users";
import { ChallengeStatus, type Challenge } from "@specarena/engine/types";

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
    return { label: "Ended", dotColor: "#555555", textColor: "#555555", animate: false };
  if (status === ChallengeStatus.Active)
    return { label: "Live", dotColor: "#8b0000", textColor: "#8b0000", animate: true };
  if (waitingForPlayers)
    return { label: "Waiting", dotColor: "#999999", textColor: "#999999", animate: true };
  return { label: "Not Started", dotColor: "#999999", textColor: "#999999", animate: false };
};

export default function ChallengesList({ challenges, challengeType, profiles = {}, total, page = 1, pageSize = 50, basePath, subtitle }: ChallengesListProps) {
  const router = useRouter();
  const displayTotal = total ?? challenges.length;
  const totalPages = pageSize > 0 ? Math.ceil(displayTotal / pageSize) : 1;
  const hasPagination = basePath && totalPages > 1;

  const smallCapsStyle = {
    fontVariant: 'small-caps' as const,
    letterSpacing: '0.08em',
    fontSize: '0.65rem',
    color: '#555555',
    fontFamily: 'var(--font-lora), serif',
    fontWeight: 600,
  };

  return (
    <div style={{ marginTop: '2.5rem' }}>
      {/* Section heading */}
      <div style={{ borderTop: '3px double #111111', paddingTop: '0.5rem', marginBottom: '0.75rem' }}>
        <h2 style={{
          fontFamily: 'var(--font-playfair), serif',
          fontSize: '1.4rem',
          fontWeight: '700',
          color: '#111111',
        }}>
          Game Log
        </h2>
      </div>
      {subtitle && <div style={{ marginBottom: '1rem', fontFamily: 'var(--font-lora), serif', fontSize: '0.82rem', color: '#555555' }}>{subtitle}</div>}
      {challenges.length === 0 ? (
        <div style={{ border: '1px solid #111111', padding: '2rem', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-lora), serif', fontStyle: 'italic', color: '#555555' }}>No challenges created yet. Be the first to participate.</p>
        </div>
      ) : (
        <div style={{ border: '1px solid #111111' }}>
          {/* Header row */}
          <div className="flex items-center px-4 py-2" style={{ borderBottom: '2px solid #111111', background: '#f0ede6' }}>
            <span className="w-[80px] max-sm:hidden shrink-0" style={smallCapsStyle}>ID</span>
            <span className="w-[130px] max-sm:hidden shrink-0" style={smallCapsStyle}>Status</span>
            <span className="w-[100px] shrink-0 max-sm:hidden" style={smallCapsStyle}>Date</span>
            <span className="min-w-0 flex-1" style={smallCapsStyle}>Player</span>
            <span className="w-[60px] max-sm:w-[40px] text-right shrink-0 pl-3 max-sm:pl-1" style={smallCapsStyle}><span className="max-sm:hidden">Utility</span><span className="sm:hidden">U</span></span>
            <span className="w-[60px] max-sm:w-[40px] max-sm:mr-1 text-right shrink-0 pl-3 max-sm:pl-1" style={smallCapsStyle}><span className="max-sm:hidden">Security</span><span className="sm:hidden">S</span></span>
            <span className="w-4 ml-2 shrink-0 max-sm:hidden"></span>
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
                className="flex items-start px-4 py-3 cursor-pointer"
                style={{
                  borderBottom: rowIndex < challenges.length - 1 ? '1px solid #ddd8cc' : 'none',
                  background: 'transparent',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f0ede6')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span className="w-[80px] shrink-0 max-sm:hidden" style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#888' }}>
                  {challengeInstance.id.slice(0, 8)}
                </span>
                <span className="w-[130px] max-sm:hidden shrink-0 flex items-center gap-1.5" style={{ fontSize: '0.78rem', color: status.textColor, fontFamily: 'var(--font-lora), serif' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: status.dotColor, display: 'inline-block', flexShrink: 0 }} className={status.animate ? 'animate-pulse' : ''}></span>
                  {status.label}
                </span>
                <span className="w-[100px] shrink-0 max-sm:hidden" style={{ fontSize: '0.72rem', color: '#888', fontFamily: 'var(--font-lora), serif' }}>
                  {formatDate(challengeInstance.createdAt)}
                </span>
                {players.length > 0 && challengeInstance.state?.scores ? (
                  <div className="min-w-0 flex-1">
                    <span className="sm:hidden block" style={{ fontFamily: 'monospace', fontSize: '0.65rem', color: '#888', marginBottom: 2 }}>{challengeInstance.id.slice(0, 8)}</span>
                    {players.map((p, i) => {
                      const name = profiles[p]?.username;
                      const short = p.slice(0, 8);
                      const score = challengeInstance.state?.scores?.[i];
                      const scores = challengeInstance.state?.scores;
                      const didBreach = scores?.some((s, j) => j !== i && s.security === -1);
                      return (
                        <div key={i} className="flex items-center leading-tight">
                          <span className="min-w-0 flex-1 truncate" style={{ fontSize: '0.78rem', color: '#333', fontFamily: 'var(--font-lora), serif' }}>
                            <Link
                              href={`/users/${p}`}
                              onClick={(e) => e.stopPropagation()}
                              style={{ color: '#111', textDecoration: 'none' }}
                              onMouseEnter={e => (e.currentTarget.style.color = '#8b0000')}
                              onMouseLeave={e => (e.currentTarget.style.color = '#111')}
                            >
                              {name ?? short}{name && <span style={{ color: '#888' }}> ({short})</span>}
                            </Link>
                            {didBreach && <FireIcon className="inline-block w-3 h-3 ml-1" style={{ color: '#8b0000' }} />}
                          </span>
                          <span className="w-[60px] max-sm:w-[40px] text-right shrink-0 pl-3 max-sm:pl-1" style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: score?.utility === -1 ? '#8b0000' : '#555' }}>{score?.utility ?? '–'}</span>
                          <span className="w-[60px] max-sm:w-[40px] max-sm:mr-1 text-right shrink-0 pl-3 max-sm:pl-1" style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: score?.security === -1 ? '#8b0000' : '#555' }}>{score?.security ?? '–'}</span>
                          <span className="w-4 ml-2 shrink-0 max-sm:hidden"></span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate" style={{ fontSize: '0.78rem', color: '#333', fontFamily: 'var(--font-lora), serif' }}>
                      <span className="sm:hidden block" style={{ fontFamily: 'monospace', fontSize: '0.65rem', color: '#888', marginBottom: 2 }}>{challengeInstance.id.slice(0, 8)}</span>
                      {players.map((p, i) => {
                        const name = profiles[p]?.username;
                        const short = p.slice(0, 8);
                        return (
                          <span key={i}>
                            {i > 0 && ', '}
                            <Link
                              href={`/users/${p}`}
                              onClick={(e) => e.stopPropagation()}
                              style={{ color: '#111', textDecoration: 'none' }}
                            >
                              {name ?? short}{name && <span style={{ color: '#888' }}> ({short})</span>}
                            </Link>
                          </span>
                        );
                      })}
                    </span>
                    <svg className="w-4 h-4 shrink-0 ml-2" fill="none" stroke="#aaa" viewBox="0 0 24 24">
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
        <div className="flex items-center justify-between mt-4" style={{ fontFamily: 'var(--font-lora), serif', fontSize: '0.8rem', fontVariant: 'small-caps', letterSpacing: '0.07em' }}>
          {page > 1 ? (
            <Link href={page === 2 ? basePath : `${basePath}?page=${page - 1}`} style={{ color: '#8b0000', textDecoration: 'none' }}>
              ← Previous
            </Link>
          ) : (
            <span style={{ color: '#ccc' }}>← Previous</span>
          )}
          <span style={{ color: '#555' }}>Page {page} of {totalPages}</span>
          {page < totalPages ? (
            <Link href={`${basePath}?page=${page + 1}`} style={{ color: '#8b0000', textDecoration: 'none' }}>
              Next →
            </Link>
          ) : (
            <span style={{ color: '#ccc' }}>Next →</span>
          )}
        </div>
      )}
    </div>
  );
}
