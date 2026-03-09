"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FireIcon } from "@heroicons/react/24/solid";
import type { UserProfile } from "@arena/engine/users";
import type { Challenge } from "@arena/engine/types";

interface ChallengesListProps {
  challenges: Challenge[];
  challengeType: string;
  profiles?: Record<string, UserProfile>;
  total?: number;
  page?: number;
  pageSize?: number;
  basePath?: string;
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
  const waitingForPlayers = status === "open" && players.length > 0 && players.length < c.invites.length;
  if (status === "ended")
    return { label: "Ended", dotColor: "bg-zinc-500", textColor: "text-zinc-600", animate: false };
  if (status === "active")
    return { label: "Live", dotColor: "bg-green-500", textColor: "text-green-600", animate: true };
  if (waitingForPlayers)
    return { label: "Waiting for players", dotColor: "bg-zinc-300", textColor: "text-zinc-500", animate: true };
  return { label: "Not Started", dotColor: "bg-zinc-300", textColor: "text-zinc-500", animate: false };
};

export default function ChallengesList({ challenges, challengeType, profiles = {}, total, page = 1, pageSize = 50, basePath }: ChallengesListProps) {
  const router = useRouter();
  const displayTotal = total ?? challenges.length;
  const totalPages = pageSize > 0 ? Math.ceil(displayTotal / pageSize) : 1;
  const hasPagination = basePath && totalPages > 1;

  return (
    <div className="mt-12">
      <h2 className="text-2xl font-semibold text-zinc-900 mb-6" style={{ fontFamily: 'var(--font-jost), sans-serif' }}>
        Challenges ({displayTotal})
      </h2>
      {challenges.length === 0 ? (
        <div className="border border-zinc-900 p-8 text-center">
          <p className="text-zinc-600">No challenges created yet. Be the first to participate!</p>
        </div>
      ) : (
        <div className="border border-zinc-900 divide-y divide-zinc-100">
          <div className="flex items-center px-5 py-3 text-xs text-zinc-400 uppercase tracking-wider border-b border-zinc-200">
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
            const players = challengeInstance.state?.status === "ended"
              && challengeInstance.state.playerIdentities
              ? Object.values(challengeInstance.state.playerIdentities)
              : [];
            const challengeHref = `/challenges/${challengeType || challengeInstance.challengeType}/${challengeInstance.id}`;
            return (
              <div
                key={challengeInstance.id}
                onClick={() => router.push(challengeHref)}
                className="flex items-start px-5 py-4 hover:bg-zinc-50 transition-colors cursor-pointer"
              >
                <span className={`w-1.5 h-1.5 mt-[7px] ${status.dotColor} rounded-full ${status.animate ? 'animate-pulse' : ''} shrink-0 mr-3 sm:hidden`}></span>
                <span className="w-[80px] text-sm text-zinc-400 font-mono shrink-0 max-sm:hidden">
                  {challengeInstance.id.slice(0, 8)}
                </span>
                <span className={`w-[140px] max-sm:hidden text-sm ${status.textColor} flex items-center gap-2 font-medium shrink-0`}>
                  <span className={`w-1.5 h-1.5 ${status.dotColor} rounded-full ${status.animate ? 'animate-pulse' : ''}`}></span>
                  {status.label}
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
