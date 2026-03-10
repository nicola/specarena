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
    return { label: "Ended", dotColor: "bg-zinc-500", textColor: "text-zinc-100", animate: false, badge: "bg-zinc-600 text-white" };
  if (status === ChallengeStatus.Active)
    return { label: "Live", dotColor: "bg-emerald-300", textColor: "text-white", animate: true, badge: "bg-emerald-600 text-white" };
  if (waitingForPlayers)
    return { label: "Waiting for players", dotColor: "bg-amber-300", textColor: "text-white", animate: true, badge: "bg-amber-500 text-white" };
  return { label: "Not Started", dotColor: "bg-zinc-400", textColor: "text-zinc-100", animate: false, badge: "bg-zinc-500 text-white" };
};

export default function ChallengesList({ challenges, challengeType, profiles = {}, total, page = 1, pageSize = 50, basePath, subtitle }: ChallengesListProps) {
  const router = useRouter();
  const displayTotal = total ?? challenges.length;
  const totalPages = pageSize > 0 ? Math.ceil(displayTotal / pageSize) : 1;
  const hasPagination = basePath && totalPages > 1;

  return (
    <div className="mt-12">
      <div className="flex items-center gap-3 mb-2">
        <span className="inline-block w-1 h-7 rounded-full flex-shrink-0" style={{ background: 'linear-gradient(180deg, #4f46e5, #7c3aed)' }} />
        <h2 className="text-2xl font-semibold" style={{ fontFamily: 'var(--font-jost), sans-serif', color: '#1a1a1a' }}>
          Challenges
        </h2>
      </div>
      {subtitle && <div className="mt-1 mb-6">{subtitle}</div>}
      {challenges.length === 0 ? (
        <div className="p-8 text-center" style={{ border: '1px solid #e5e0d8' }}>
          <p className="text-zinc-600">No challenges created yet. Be the first to participate!</p>
        </div>
      ) : (
        <div className="divide-y" style={{ border: '1px solid #e5e0d8', borderColor: '#e5e0d8', divideColor: '#f0ece6' }}>
          <div className="flex items-center px-5 py-3 text-xs text-zinc-400 uppercase tracking-wider" style={{ borderBottom: '1px solid #e5e0d8', background: '#fafaf8' }}>
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
                className="flex items-start px-5 py-4 transition-colors cursor-pointer hover:bg-indigo-50/40"
                style={{ borderBottom: '1px solid #f0ece6' }}
              >
                <span className={`w-1.5 h-1.5 mt-[7px] ${status.dotColor} rounded-full ${status.animate ? 'animate-pulse' : ''} shrink-0 mr-3 sm:hidden`}></span>
                <span className="w-[80px] text-sm text-zinc-400 font-mono shrink-0 max-sm:hidden">
                  {challengeInstance.id.slice(0, 8)}
                </span>
                <span className="w-[140px] max-sm:hidden shrink-0">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${status.badge}`}>
                    <span className={`w-1.5 h-1.5 ${status.dotColor} rounded-full ${status.animate ? 'animate-pulse' : ''}`}></span>
                    {status.label}
                  </span>
                </span>
                <span className="w-[100px] text-sm text-zinc-400 shrink-0 max-sm:hidden">
                  {formatDate(challengeInstance.createdAt)}
                </span>
                {players.length > 0 && challengeInstance.state?.scores ? (
                  <div className="min-w-0 flex-1">
                    <span className="sm:hidden text-xs text-zinc-400 font-mono block leading-tight mt-0.5">{challengeInstance.id.slice(0, 8)}</span>
                    {players.map((p, i) => {
                      const name = profiles[p]?.username;
                      const short = p.slice(0, 8);
                      const score = challengeInstance.state?.scores?.[i];
                      const scores = challengeInstance.state?.scores;
                      // Player performed a breach if any OTHER player has security === -1
                      const didBreach = scores?.some((s, j) => j !== i && s.security === -1);
                      return (
                        <div key={i} className="flex items-center leading-tight">
                          <span className="text-sm text-zinc-600 min-w-0 flex-1 truncate">
                            <Link
                              href={`/users/${p}`}
                              onClick={(e) => e.stopPropagation()}
                              className="hover:text-zinc-900"
                            >
                              {name ?? short}{name && <span className="text-zinc-400"> ({short})</span>}
                            </Link>
                            {didBreach && <FireIcon className="inline-block w-3 h-3 ml-1 text-red-300" />}
                          </span>
                          <span className={`w-[70px] max-sm:w-[40px] text-right text-xs font-mono shrink-0 pl-3 max-sm:pl-1 ${score?.utility === -1 ? 'text-violet-300' : 'text-zinc-400'}`}>{score?.utility ?? '–'}</span>
                          <span className={`w-[70px] max-sm:w-[40px] max-sm:mr-1 text-right text-xs font-mono shrink-0 pl-3 max-sm:pl-1 ${score?.security === -1 ? 'text-red-300' : 'text-zinc-400'}`}>{score?.security ?? '–'}</span>
                          <span className="w-4 ml-2 shrink-0 max-sm:hidden"></span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <>
                    <span className="text-sm text-zinc-600 min-w-0 flex-1 truncate">
                      <span className="sm:hidden text-xs text-zinc-400 font-mono block leading-tight mt-0.5">{challengeInstance.id.slice(0, 8)}</span>
                      {players.map((p, i) => {
                        const name = profiles[p]?.username;
                        const short = p.slice(0, 8);
                        return (
                          <span key={i}>
                            {i > 0 && ', '}
                            <Link
                              href={`/users/${p}`}
                              onClick={(e) => e.stopPropagation()}
                              className="hover:text-zinc-900"
                            >
                              {name ?? short}{name && <span className="text-zinc-400"> ({short})</span>}
                            </Link>
                          </span>
                        );
                      })}
                    </span>
                    <svg className="w-4 h-4 text-zinc-300 shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            <Link href={page === 2 ? basePath : `${basePath}?page=${page - 1}`} className="text-zinc-600 hover:text-zinc-900">
              Previous
            </Link>
          ) : (
            <span className="text-zinc-300">Previous</span>
          )}
          <span className="text-zinc-400">Page {page} of {totalPages}</span>
          {page < totalPages ? (
            <Link href={`${basePath}?page=${page + 1}`} className="text-zinc-600 hover:text-zinc-900">
              Next
            </Link>
          ) : (
            <span className="text-zinc-300">Next</span>
          )}
        </div>
      )}
    </div>
  );
}
