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
    return { label: "Ended", dotColor: "#79747e", badgeBg: "#f4eff4", badgeText: "#49454f", animate: false };
  if (status === ChallengeStatus.Active)
    return { label: "Live", dotColor: "#386a20", badgeBg: "#c3efad", badgeText: "#072100", animate: true };
  if (waitingForPlayers)
    return { label: "Waiting", dotColor: "#cac4d0", badgeBg: "#f4eff4", badgeText: "#49454f", animate: true };
  return { label: "Not Started", dotColor: "#cac4d0", badgeBg: "#f4eff4", badgeText: "#79747e", animate: false };
};

export default function ChallengesList({ challenges, challengeType, profiles = {}, total, page = 1, pageSize = 50, basePath, subtitle }: ChallengesListProps) {
  const router = useRouter();
  const displayTotal = total ?? challenges.length;
  const totalPages = pageSize > 0 ? Math.ceil(displayTotal / pageSize) : 1;
  const hasPagination = basePath && totalPages > 1;

  return (
    <div className="mt-12">
      <h2 className="text-xl font-medium mb-2" style={{ color: 'var(--on-surface)', fontFamily: 'var(--font-google-sans), Roboto, sans-serif' }}>
        Challenges
      </h2>
      {subtitle && <div className="mt-1 mb-5">{subtitle}</div>}
      {challenges.length === 0 ? (
        <div
          className="p-10 text-center"
          style={{
            borderRadius: '12px',
            border: '1px solid var(--outline-variant)',
            background: 'var(--surface)',
          }}
        >
          <p style={{ color: 'var(--on-surface-variant)' }}>No challenges created yet. Be the first to participate!</p>
        </div>
      ) : (
        <div
          style={{
            borderRadius: '12px',
            border: '1px solid var(--outline-variant)',
            background: 'var(--surface)',
            boxShadow: 'var(--elevation-1)',
            overflow: 'hidden',
          }}
        >
          <div
            className="flex items-center px-5 py-3 text-xs uppercase tracking-wider"
            style={{
              color: 'var(--on-surface-variant)',
              borderBottom: '1px solid var(--outline-variant)',
              background: 'var(--surface-variant)',
              fontWeight: 500,
            }}
          >
            <span className="w-[80px] max-sm:hidden shrink-0">ID</span>
            <span className="w-[140px] max-sm:hidden shrink-0">Status</span>
            <span className="w-[100px] shrink-0 max-sm:hidden">Date</span>
            <span className="min-w-0 flex-1">Player</span>
            <span className="w-[70px] max-sm:w-[40px] text-right shrink-0 pl-3 max-sm:pl-1"><span className="max-sm:hidden">Utility</span><span className="sm:hidden">U</span></span>
            <span className="w-[70px] max-sm:w-[40px] max-sm:mr-1 text-right shrink-0 pl-3 max-sm:pl-1"><span className="max-sm:hidden">Security</span><span className="sm:hidden">S</span></span>
            <span className="w-4 ml-2 shrink-0 max-sm:hidden"></span>
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
                className="flex items-start px-5 py-4 cursor-pointer"
                style={{
                  borderTop: idx > 0 ? '1px solid var(--outline-variant)' : undefined,
                  transition: 'background-color 200ms ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(103,80,164,0.05)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <span
                  className={`w-1.5 h-1.5 mt-[7px] rounded-full shrink-0 mr-3 sm:hidden ${status.animate ? 'animate-pulse' : ''}`}
                  style={{ background: status.dotColor }}
                ></span>
                <span className="w-[80px] text-sm font-mono shrink-0 max-sm:hidden" style={{ color: 'var(--on-surface-variant)' }}>
                  {challengeInstance.id.slice(0, 8)}
                </span>
                <span className="w-[140px] max-sm:hidden text-xs font-medium flex items-center gap-1.5 shrink-0">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${status.animate ? 'animate-pulse' : ''}`}
                    style={{ background: status.dotColor }}
                  ></span>
                  <span
                    className="px-2 py-0.5 rounded-full text-xs"
                    style={{ background: status.badgeBg, color: status.badgeText, borderRadius: '8px' }}
                  >
                    {status.label}
                  </span>
                </span>
                <span className="w-[100px] text-sm shrink-0 max-sm:hidden" style={{ color: 'var(--on-surface-variant)' }}>
                  {formatDate(challengeInstance.createdAt)}
                </span>
                {players.length > 0 && challengeInstance.state?.scores ? (
                  <div className="min-w-0 flex-1">
                    <span className="sm:hidden text-xs font-mono block leading-tight mt-0.5" style={{ color: 'var(--on-surface-variant)' }}>{challengeInstance.id.slice(0, 8)}</span>
                    {players.map((p, i) => {
                      const name = profiles[p]?.username;
                      const short = p.slice(0, 8);
                      const score = challengeInstance.state?.scores?.[i];
                      const scores = challengeInstance.state?.scores;
                      const didBreach = scores?.some((s, j) => j !== i && s.security === -1);
                      return (
                        <div key={i} className="flex items-center leading-tight">
                          <span className="text-sm min-w-0 flex-1 truncate" style={{ color: 'var(--on-surface-variant)' }}>
                            <Link
                              href={`/users/${p}`}
                              onClick={(e) => e.stopPropagation()}
                              className="hover:underline"
                              style={{ color: 'var(--primary)' }}
                            >
                              {name ?? short}{name && <span style={{ color: 'var(--on-surface-variant)' }}> ({short})</span>}
                            </Link>
                            {didBreach && <FireIcon className="inline-block w-3 h-3 ml-1" style={{ color: '#ef4444' }} />}
                          </span>
                          <span className={`w-[70px] max-sm:w-[40px] text-right text-xs font-mono shrink-0 pl-3 max-sm:pl-1`} style={{ color: score?.utility === -1 ? '#7c3aed' : 'var(--on-surface-variant)' }}>{score?.utility ?? '–'}</span>
                          <span className={`w-[70px] max-sm:w-[40px] max-sm:mr-1 text-right text-xs font-mono shrink-0 pl-3 max-sm:pl-1`} style={{ color: score?.security === -1 ? '#dc2626' : 'var(--on-surface-variant)' }}>{score?.security ?? '–'}</span>
                          <span className="w-4 ml-2 shrink-0 max-sm:hidden"></span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <>
                    <span className="text-sm min-w-0 flex-1 truncate" style={{ color: 'var(--on-surface-variant)' }}>
                      <span className="sm:hidden text-xs font-mono block leading-tight mt-0.5" style={{ color: 'var(--on-surface-variant)' }}>{challengeInstance.id.slice(0, 8)}</span>
                      {players.map((p, i) => {
                        const name = profiles[p]?.username;
                        const short = p.slice(0, 8);
                        return (
                          <span key={i}>
                            {i > 0 && ', '}
                            <Link
                              href={`/users/${p}`}
                              onClick={(e) => e.stopPropagation()}
                              className="hover:underline"
                              style={{ color: 'var(--primary)' }}
                            >
                              {name ?? short}{name && <span style={{ color: 'var(--on-surface-variant)' }}> ({short})</span>}
                            </Link>
                          </span>
                        );
                      })}
                    </span>
                    <svg className="w-4 h-4 shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--outline)' }}>
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
        <div className="flex items-center justify-between mt-4 text-sm">
          {page > 1 ? (
            <Link href={page === 2 ? basePath : `${basePath}?page=${page - 1}`} className="font-medium" style={{ color: 'var(--primary)' }}>
              Previous
            </Link>
          ) : (
            <span style={{ color: 'var(--outline)' }}>Previous</span>
          )}
          <span style={{ color: 'var(--on-surface-variant)' }}>Page {page} of {totalPages}</span>
          {page < totalPages ? (
            <Link href={`${basePath}?page=${page + 1}`} className="font-medium" style={{ color: 'var(--primary)' }}>
              Next
            </Link>
          ) : (
            <span style={{ color: 'var(--outline)' }}>Next</span>
          )}
        </div>
      )}
    </div>
  );
}
