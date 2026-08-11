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
    return { label: "Ended", dotColor: "#8b4513", textColor: "#8b4513", animate: false };
  if (status === ChallengeStatus.Active)
    return { label: "Live", dotColor: "#2d7a3a", textColor: "#2d7a3a", animate: true };
  if (waitingForPlayers)
    return { label: "Waiting for players", dotColor: "#b8997a", textColor: "#b8997a", animate: true };
  return { label: "Not Started", dotColor: "#b8997a", textColor: "#b8997a", animate: false };
};

export default function ChallengesList({ challenges, challengeType, profiles = {}, total, page = 1, pageSize = 50, basePath, subtitle }: ChallengesListProps) {
  const router = useRouter();
  const displayTotal = total ?? challenges.length;
  const totalPages = pageSize > 0 ? Math.ceil(displayTotal / pageSize) : 1;
  const hasPagination = basePath && totalPages > 1;

  return (
    <div className="mt-12">
      <h2
        className="text-2xl font-semibold mb-2"
        style={{
          fontFamily: 'var(--font-noto-serif), serif',
          color: '#1a1008',
          borderBottom: '2px solid #cc2200',
          paddingBottom: '0.5rem',
          display: 'inline-block',
        }}
      >
        Challenges
      </h2>
      {subtitle && <div className="mt-1 mb-6">{subtitle}</div>}
      {challenges.length === 0 ? (
        <div
          className="p-8 text-center"
          style={{ border: '1px solid #d4c4a8', background: '#faf6ef' }}
        >
          <p style={{ color: '#8b4513' }}>No challenges created yet. Be the first to participate!</p>
        </div>
      ) : (
        <div style={{ border: '1px solid #d4c4a8', background: '#faf6ef' }}>
          {/* Header row */}
          <div
            className="flex items-center px-5 py-3 text-xs uppercase tracking-wider"
            style={{
              color: '#8b4513',
              borderBottom: '1px solid #d4c4a8',
              background: '#f0e8d8',
              fontFamily: 'var(--font-noto-sans)',
              letterSpacing: '0.08em',
            }}
          >
            <span className="w-[80px] max-sm:hidden shrink-0">ID</span>
            <span className="w-[140px] max-sm:hidden shrink-0">Status</span>
            <span className="w-[100px] shrink-0 max-sm:hidden">Date</span>
            <span className="min-w-0 flex-1">Player</span>
            <span className="w-[70px] max-sm:w-[40px] text-right shrink-0 pl-3 max-sm:pl-1">
              <span className="max-sm:hidden">Utility</span><span className="sm:hidden">U</span>
            </span>
            <span className="w-[70px] max-sm:w-[40px] max-sm:mr-1 text-right shrink-0 pl-3 max-sm:pl-1">
              <span className="max-sm:hidden">Security</span><span className="sm:hidden">S</span>
            </span>
            <span className="w-4 ml-2 shrink-0 max-sm:hidden"></span>
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
                className="flex items-start px-5 py-4 cursor-pointer transition-colors duration-150"
                style={{ borderBottom: '1px solid #e8dcc8' }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = '#f0e8d8';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                <span
                  className="w-1.5 h-1.5 mt-[7px] rounded-full shrink-0 mr-3 sm:hidden"
                  style={{ background: status.dotColor, animation: status.animate ? 'pulse 2s infinite' : 'none' }}
                />
                <span
                  className="w-[80px] text-sm font-mono shrink-0 max-sm:hidden"
                  style={{ color: '#b8997a' }}
                >
                  {challengeInstance.id.slice(0, 8)}
                </span>
                <span
                  className="w-[140px] max-sm:hidden text-sm flex items-center gap-2 font-medium shrink-0"
                  style={{ color: status.textColor }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: status.dotColor, flexShrink: 0, animation: status.animate ? 'pulse 2s infinite' : 'none' }}
                  />
                  {status.label}
                </span>
                <span className="w-[100px] text-sm shrink-0 max-sm:hidden" style={{ color: '#b8997a' }}>
                  {formatDate(challengeInstance.createdAt)}
                </span>
                {players.length > 0 && challengeInstance.state?.scores ? (
                  <div className="min-w-0 flex-1">
                    <span className="sm:hidden text-xs font-mono block leading-tight mt-0.5" style={{ color: '#b8997a' }}>
                      {challengeInstance.id.slice(0, 8)}
                    </span>
                    {players.map((p, i) => {
                      const name = profiles[p]?.username;
                      const short = p.slice(0, 8);
                      const score = challengeInstance.state?.scores?.[i];
                      const scores = challengeInstance.state?.scores;
                      const didBreach = scores?.some((s, j) => j !== i && s.security === -1);
                      return (
                        <div key={i} className="flex items-center leading-tight">
                          <span className="text-sm min-w-0 flex-1 truncate" style={{ color: '#5a4030' }}>
                            <Link
                              href={`/users/${p}`}
                              onClick={(e) => e.stopPropagation()}
                              style={{ color: '#5a4030', textDecoration: 'none' }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = '#cc2200')}
                              onMouseLeave={(e) => (e.currentTarget.style.color = '#5a4030')}
                            >
                              {name ?? short}{name && <span style={{ color: '#b8997a' }}> ({short})</span>}
                            </Link>
                            {didBreach && <FireIcon className="inline-block w-3 h-3 ml-1" style={{ color: '#cc2200', opacity: 0.6 }} />}
                          </span>
                          <span
                            className="w-[70px] max-sm:w-[40px] text-right text-xs font-mono shrink-0 pl-3 max-sm:pl-1"
                            style={{ color: score?.utility === -1 ? '#7c3aed' : '#b8997a' }}
                          >
                            {score?.utility ?? '–'}
                          </span>
                          <span
                            className="w-[70px] max-sm:w-[40px] max-sm:mr-1 text-right text-xs font-mono shrink-0 pl-3 max-sm:pl-1"
                            style={{ color: score?.security === -1 ? '#cc2200' : '#b8997a' }}
                          >
                            {score?.security ?? '–'}
                          </span>
                          <span className="w-4 ml-2 shrink-0 max-sm:hidden"></span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <>
                    <span className="text-sm min-w-0 flex-1 truncate" style={{ color: '#5a4030' }}>
                      <span className="sm:hidden text-xs font-mono block leading-tight mt-0.5" style={{ color: '#b8997a' }}>
                        {challengeInstance.id.slice(0, 8)}
                      </span>
                      {players.map((p, i) => {
                        const name = profiles[p]?.username;
                        const short = p.slice(0, 8);
                        return (
                          <span key={i}>
                            {i > 0 && ', '}
                            <Link
                              href={`/users/${p}`}
                              onClick={(e) => e.stopPropagation()}
                              style={{ color: '#5a4030', textDecoration: 'none' }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = '#cc2200')}
                              onMouseLeave={(e) => (e.currentTarget.style.color = '#5a4030')}
                            >
                              {name ?? short}{name && <span style={{ color: '#b8997a' }}> ({short})</span>}
                            </Link>
                          </span>
                        );
                      })}
                    </span>
                    <svg className="w-4 h-4 shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#b8997a' }}>
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
        <div className="flex items-center justify-between mt-4 text-sm" style={{ fontFamily: 'var(--font-noto-sans)' }}>
          {page > 1 ? (
            <Link
              href={page === 2 ? basePath : `${basePath}?page=${page - 1}`}
              style={{ color: '#8b4513', textDecoration: 'none' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#cc2200')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#8b4513')}
            >
              ← Previous
            </Link>
          ) : (
            <span style={{ color: '#d4c4a8' }}>← Previous</span>
          )}
          <span style={{ color: '#b8997a' }}>Page {page} of {totalPages}</span>
          {page < totalPages ? (
            <Link
              href={`${basePath}?page=${page + 1}`}
              style={{ color: '#8b4513', textDecoration: 'none' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#cc2200')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#8b4513')}
            >
              Next →
            </Link>
          ) : (
            <span style={{ color: '#d4c4a8' }}>Next →</span>
          )}
        </div>
      )}
    </div>
  );
}
