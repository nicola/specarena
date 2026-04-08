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
    return { label: "Ended", dotColor: "#aaaaaa", textColor: "#aaaaaa", animate: false };
  if (status === ChallengeStatus.Active)
    return { label: "Live", dotColor: "#22c55e", textColor: "#16a34a", animate: true };
  if (waitingForPlayers)
    return { label: "Waiting", dotColor: "#aaaaaa", textColor: "#aaaaaa", animate: true };
  return { label: "Not Started", dotColor: "#dddddd", textColor: "#aaaaaa", animate: false };
};

export default function ChallengesList({ challenges, challengeType, profiles = {}, total, page = 1, pageSize = 50, basePath, subtitle }: ChallengesListProps) {
  const router = useRouter();
  const displayTotal = total ?? challenges.length;
  const totalPages = pageSize > 0 ? Math.ceil(displayTotal / pageSize) : 1;
  const hasPagination = basePath && totalPages > 1;

  return (
    <div className="mt-16">
      <h2 className="text-sm font-medium mb-1" style={{ color: '#1a1a1a', fontWeight: 500, letterSpacing: '0.05em' }}>
        Challenges
      </h2>
      {subtitle && <div className="mt-1 mb-6">{subtitle}</div>}
      {challenges.length === 0 ? (
        <div className="p-12 text-center" style={{ border: '1px solid #eeeeee' }}>
          <p className="text-xs" style={{ color: '#aaaaaa' }}>No challenges yet. Be the first to participate.</p>
        </div>
      ) : (
        <div style={{ border: '1px solid #eeeeee' }}>
          <div className="flex items-center px-6 py-3 text-xs uppercase tracking-wider" style={{ color: '#aaaaaa', borderBottom: '1px solid #eeeeee', letterSpacing: '0.1em' }}>
            <span className="w-[80px] max-sm:hidden shrink-0">ID</span>
            <span className="w-[140px] max-sm:hidden shrink-0">Status</span>
            <span className="w-[100px] shrink-0 max-sm:hidden">Date</span>
            <span className="min-w-0 flex-1">Player</span>
            <span className="w-[70px] max-sm:w-[40px] text-right shrink-0 pl-3 max-sm:pl-1"><span className="max-sm:hidden">Utility</span><span className="sm:hidden">U</span></span>
            <span className="w-[70px] max-sm:w-[40px] max-sm:mr-1 text-right shrink-0 pl-3 max-sm:pl-1"><span className="max-sm:hidden">Security</span><span className="sm:hidden">S</span></span>
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
                className="flex items-start px-6 py-4 cursor-pointer transition-colors"
                style={{ borderBottom: '1px solid #f5f5f5' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                onMouseLeave={e => (e.currentTarget.style.background = 'white')}
              >
                <span
                  className={`w-1.5 h-1.5 mt-[7px] rounded-full shrink-0 mr-3 sm:hidden ${status.animate ? 'animate-pulse' : ''}`}
                  style={{ backgroundColor: status.dotColor }}
                ></span>
                <span className="w-[80px] text-xs font-mono shrink-0 max-sm:hidden" style={{ color: '#aaaaaa' }}>
                  {challengeInstance.id.slice(0, 8)}
                </span>
                <span className={`w-[140px] max-sm:hidden text-xs flex items-center gap-2 shrink-0 ${status.animate ? '' : ''}`} style={{ color: status.textColor }}>
                  <span className={`w-1 h-1 rounded-full shrink-0 ${status.animate ? 'animate-pulse' : ''}`} style={{ backgroundColor: status.dotColor }}></span>
                  {status.label}
                </span>
                <span className="w-[100px] text-xs shrink-0 max-sm:hidden" style={{ color: '#aaaaaa' }}>
                  {formatDate(challengeInstance.createdAt)}
                </span>
                {players.length > 0 && challengeInstance.state?.scores ? (
                  <div className="min-w-0 flex-1">
                    <span className="sm:hidden text-xs font-mono block leading-tight mt-0.5" style={{ color: '#aaaaaa' }}>{challengeInstance.id.slice(0, 8)}</span>
                    {players.map((p, i) => {
                      const name = profiles[p]?.username;
                      const short = p.slice(0, 8);
                      const score = challengeInstance.state?.scores?.[i];
                      const scores = challengeInstance.state?.scores;
                      const didBreach = scores?.some((s, j) => j !== i && s.security === -1);
                      return (
                        <div key={i} className="flex items-center leading-tight">
                          <span className="text-xs min-w-0 flex-1 truncate" style={{ color: '#1a1a1a' }}>
                            <Link
                              href={`/users/${p}`}
                              onClick={(e) => e.stopPropagation()}
                              className="hover:underline"
                            >
                              {name ?? short}{name && <span style={{ color: '#aaaaaa' }}> ({short})</span>}
                            </Link>
                            {didBreach && <FireIcon className="inline-block w-3 h-3 ml-1" style={{ color: '#cc0000' }} />}
                          </span>
                          <span className="w-[70px] max-sm:w-[40px] text-right text-xs font-mono shrink-0 pl-3 max-sm:pl-1" style={{ color: score?.utility === -1 ? '#9333ea' : '#aaaaaa' }}>{score?.utility ?? '–'}</span>
                          <span className="w-[70px] max-sm:w-[40px] max-sm:mr-1 text-right text-xs font-mono shrink-0 pl-3 max-sm:pl-1" style={{ color: score?.security === -1 ? '#cc0000' : '#aaaaaa' }}>{score?.security ?? '–'}</span>
                          <span className="w-4 ml-2 shrink-0 max-sm:hidden"></span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <>
                    <span className="text-xs min-w-0 flex-1 truncate" style={{ color: '#1a1a1a' }}>
                      <span className="sm:hidden text-xs font-mono block leading-tight mt-0.5" style={{ color: '#aaaaaa' }}>{challengeInstance.id.slice(0, 8)}</span>
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
                            >
                              {name ?? short}{name && <span style={{ color: '#aaaaaa' }}> ({short})</span>}
                            </Link>
                          </span>
                        );
                      })}
                    </span>
                    <svg className="w-3 h-3 shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#dddddd' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
      {hasPagination && (
        <div className="flex items-center justify-between mt-6 text-xs" style={{ color: '#aaaaaa' }}>
          {page > 1 ? (
            <Link href={page === 2 ? basePath : `${basePath}?page=${page - 1}`} className="hover:underline" style={{ color: '#1a1a1a' }}>
              Previous
            </Link>
          ) : (
            <span style={{ color: '#dddddd' }}>Previous</span>
          )}
          <span>Page {page} of {totalPages}</span>
          {page < totalPages ? (
            <Link href={`${basePath}?page=${page + 1}`} className="hover:underline" style={{ color: '#1a1a1a' }}>
              Next
            </Link>
          ) : (
            <span style={{ color: '#dddddd' }}>Next</span>
          )}
        </div>
      )}
    </div>
  );
}
