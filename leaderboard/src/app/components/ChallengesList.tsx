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
  const { status, players = [], playerIdentities } = c.state ?? {};
  const waitingForPlayers = status === ChallengeStatus.Open && players.length > 0 && players.length < c.invites.length;
  if (status === ChallengeStatus.Ended)
    return { label: "Ended", dotColor: "bg-zinc-600", textColor: "text-zinc-500", animate: false };
  if (status === ChallengeStatus.Active)
    return { label: "Live", dotColor: "bg-green-500", textColor: "text-green-400", animate: true };
  if (waitingForPlayers)
    return { label: "Waiting for players", dotColor: "bg-zinc-600", textColor: "text-zinc-500", animate: true };
  return { label: "Not Started", dotColor: "bg-zinc-600", textColor: "text-zinc-500", animate: false };
};

export default function ChallengesList({ challenges, challengeType, profiles = {}, total, page = 1, pageSize = 50, basePath, subtitle }: ChallengesListProps) {
  const router = useRouter();
  const displayTotal = total ?? challenges.length;
  const totalPages = pageSize > 0 ? Math.ceil(displayTotal / pageSize) : 1;
  const hasPagination = basePath && totalPages > 1;

  return (
    <div className="mt-12">
      <h2 className="text-2xl font-semibold mb-2" style={{ fontFamily: 'var(--font-jost), sans-serif', color: '#e6edf3' }}>
        Challenges
      </h2>
      {subtitle && <div className="mt-1 mb-6">{subtitle}</div>}
      {challenges.length === 0 ? (
        <div className="p-8 text-center" style={{ border: '1px solid #30363d' }}>
          <p style={{ color: '#7d8590' }}>No challenges created yet. Be the first to participate!</p>
        </div>
      ) : (
        <div style={{ border: '1px solid #30363d' }}>
          <div className="flex items-center px-5 py-3 text-xs uppercase tracking-wider" style={{ borderBottom: '1px solid #30363d', color: '#7d8590' }}>
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
                className="flex items-start px-5 py-4 cursor-pointer transition-colors"
                style={{ borderTop: '1px solid #30363d' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#1f2430')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span className={`w-1.5 h-1.5 mt-[7px] ${status.dotColor} rounded-full ${status.animate ? 'animate-pulse' : ''} shrink-0 mr-3 sm:hidden`}></span>
                <span className="w-[80px] text-sm font-mono shrink-0 max-sm:hidden" style={{ color: '#7d8590' }}>
                  {challengeInstance.id.slice(0, 8)}
                </span>
                <span className={`w-[140px] max-sm:hidden text-sm flex items-center gap-2 font-medium shrink-0 ${status.textColor}`}>
                  <span className={`w-1.5 h-1.5 ${status.dotColor} rounded-full ${status.animate ? 'animate-pulse' : ''}`}></span>
                  {status.label}
                </span>
                <span className="w-[100px] text-sm shrink-0 max-sm:hidden" style={{ color: '#7d8590' }}>
                  {formatDate(challengeInstance.createdAt)}
                </span>
                {players.length > 0 && challengeInstance.state?.scores ? (
                  <div className="min-w-0 flex-1">
                    <span className="sm:hidden text-xs font-mono block leading-tight mt-0.5" style={{ color: '#7d8590' }}>{challengeInstance.id.slice(0, 8)}</span>
                    {players.map((p, i) => {
                      const name = profiles[p]?.username;
                      const short = p.slice(0, 8);
                      const score = challengeInstance.state?.scores?.[i];
                      const scores = challengeInstance.state?.scores;
                      // Player performed a breach if any OTHER player has security === -1
                      const didBreach = scores?.some((s, j) => j !== i && s.security === -1);
                      return (
                        <div key={i} className="flex items-center leading-tight">
                          <span className="text-sm min-w-0 flex-1 truncate" style={{ color: '#7d8590' }}>
                            <Link
                              href={`/users/${p}`}
                              onClick={(e) => e.stopPropagation()}
                              className="transition-colors"
                              style={{ color: '#8b949e' }}
                              onMouseEnter={e => ((e.target as HTMLElement).style.color = '#e6edf3')}
                              onMouseLeave={e => ((e.target as HTMLElement).style.color = '#8b949e')}
                            >
                              {name ?? short}{name && <span style={{ color: '#7d8590' }}> ({short})</span>}
                            </Link>
                            {didBreach && <FireIcon className="inline-block w-3 h-3 ml-1 text-red-400" />}
                          </span>
                          <span className={`w-[70px] max-sm:w-[40px] text-right text-xs font-mono shrink-0 pl-3 max-sm:pl-1 ${score?.utility === -1 ? 'text-violet-400' : ''}`} style={score?.utility === -1 ? {} : { color: '#7d8590' }}>{score?.utility ?? '–'}</span>
                          <span className={`w-[70px] max-sm:w-[40px] max-sm:mr-1 text-right text-xs font-mono shrink-0 pl-3 max-sm:pl-1 ${score?.security === -1 ? 'text-red-400' : ''}`} style={score?.security === -1 ? {} : { color: '#7d8590' }}>{score?.security ?? '–'}</span>
                          <span className="w-4 ml-2 shrink-0 max-sm:hidden"></span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <>
                    <span className="text-sm min-w-0 flex-1 truncate" style={{ color: '#7d8590' }}>
                      <span className="sm:hidden text-xs font-mono block leading-tight mt-0.5" style={{ color: '#7d8590' }}>{challengeInstance.id.slice(0, 8)}</span>
                      {players.map((p, i) => {
                        const name = profiles[p]?.username;
                        const short = p.slice(0, 8);
                        return (
                          <span key={i}>
                            {i > 0 && ', '}
                            <Link
                              href={`/users/${p}`}
                              onClick={(e) => e.stopPropagation()}
                              style={{ color: '#8b949e' }}
                              onMouseEnter={e => ((e.target as HTMLElement).style.color = '#e6edf3')}
                              onMouseLeave={e => ((e.target as HTMLElement).style.color = '#8b949e')}
                            >
                              {name ?? short}{name && <span style={{ color: '#7d8590' }}> ({short})</span>}
                            </Link>
                          </span>
                        );
                      })}
                    </span>
                    <svg className="w-4 h-4 shrink-0 ml-2" style={{ color: '#30363d' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            <Link href={page === 2 ? basePath : `${basePath}?page=${page - 1}`} style={{ color: '#58a6ff' }}>
              Previous
            </Link>
          ) : (
            <span style={{ color: '#30363d' }}>Previous</span>
          )}
          <span style={{ color: '#7d8590' }}>Page {page} of {totalPages}</span>
          {page < totalPages ? (
            <Link href={`${basePath}?page=${page + 1}`} style={{ color: '#58a6ff' }}>
              Next
            </Link>
          ) : (
            <span style={{ color: '#30363d' }}>Next</span>
          )}
        </div>
      )}
    </div>
  );
}
