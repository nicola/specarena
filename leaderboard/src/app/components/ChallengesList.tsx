"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
    return { label: "Ended", dotStyle: "border border-[#555] bg-transparent", textColor: "text-[#555]", animate: false };
  if (status === ChallengeStatus.Active)
    return { label: "Live", dotStyle: "bg-black", textColor: "text-black", animate: true };
  if (waitingForPlayers)
    return { label: "Waiting for players", dotStyle: "border border-[#999] bg-transparent", textColor: "text-[#777]", animate: true };
  return { label: "Not Started", dotStyle: "border border-[#ccc] bg-transparent", textColor: "text-[#999]", animate: false };
};

export default function ChallengesList({ challenges, challengeType, profiles = {}, total, page = 1, pageSize = 50, basePath, subtitle }: ChallengesListProps) {
  const router = useRouter();
  const displayTotal = total ?? challenges.length;
  const totalPages = pageSize > 0 ? Math.ceil(displayTotal / pageSize) : 1;
  const hasPagination = basePath && totalPages > 1;

  return (
    <div className="mt-12">
      <div className="border-t border-black pt-6 mb-6">
        <h2 className="text-2xl font-black text-black" style={{ fontFamily: 'var(--font-jost), sans-serif' }}>
          Challenges
        </h2>
        {subtitle && <div className="mt-1">{subtitle}</div>}
      </div>
      {challenges.length === 0 ? (
        <div className="border border-black p-8 text-center">
          <p className="text-[#555]">No challenges created yet. Be the first to participate!</p>
        </div>
      ) : (
        <div className="border border-black divide-y divide-[#eee]">
          <div className="flex items-center px-5 py-3 text-xs text-[#777] uppercase tracking-wider border-b border-black">
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
                className="flex items-start px-5 py-4 hover:bg-black hover:text-white transition-colors cursor-pointer group"
              >
                <span className={`w-1.5 h-1.5 mt-[7px] rounded-full ${status.dotStyle} ${status.animate ? 'animate-pulse' : ''} shrink-0 mr-3 sm:hidden`}></span>
                <span className="w-[80px] text-sm text-[#777] group-hover:text-[#ccc] font-mono shrink-0 max-sm:hidden">
                  {challengeInstance.id.slice(0, 8)}
                </span>
                <span className={`w-[140px] max-sm:hidden text-sm flex items-center gap-2 font-medium shrink-0 ${status.textColor} group-hover:text-white`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${status.dotStyle} ${status.animate ? 'animate-pulse' : ''}`}></span>
                  {status.label}
                </span>
                <span className="w-[100px] text-sm text-[#777] group-hover:text-[#ccc] shrink-0 max-sm:hidden">
                  {formatDate(challengeInstance.createdAt)}
                </span>
                {players.length > 0 && challengeInstance.state?.scores ? (
                  <div className="min-w-0 flex-1">
                    <span className="sm:hidden text-xs text-[#777] font-mono block leading-tight mt-0.5">{challengeInstance.id.slice(0, 8)}</span>
                    {players.map((p, i) => {
                      const name = profiles[p]?.username;
                      const short = p.slice(0, 8);
                      const score = challengeInstance.state?.scores?.[i];
                      return (
                        <div key={i} className="flex items-center leading-tight">
                          <span className="text-sm text-[#333] group-hover:text-white min-w-0 flex-1 truncate">
                            <Link
                              href={`/users/${p}`}
                              onClick={(e) => e.stopPropagation()}
                              className="hover:underline"
                            >
                              {name ?? short}{name && <span className="text-[#777] group-hover:text-[#ccc]"> ({short})</span>}
                            </Link>
                          </span>
                          <span className="w-[70px] max-sm:w-[40px] text-right text-xs font-mono shrink-0 pl-3 max-sm:pl-1 text-[#555] group-hover:text-[#ccc]">{score?.utility ?? '–'}</span>
                          <span className="w-[70px] max-sm:w-[40px] max-sm:mr-1 text-right text-xs font-mono shrink-0 pl-3 max-sm:pl-1 text-[#555] group-hover:text-[#ccc]">{score?.security ?? '–'}</span>
                          <span className="w-4 ml-2 shrink-0 max-sm:hidden"></span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <>
                    <span className="text-sm text-[#333] group-hover:text-white min-w-0 flex-1 truncate">
                      <span className="sm:hidden text-xs text-[#777] font-mono block leading-tight mt-0.5">{challengeInstance.id.slice(0, 8)}</span>
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
                              {name ?? short}{name && <span className="text-[#777] group-hover:text-[#ccc]"> ({short})</span>}
                            </Link>
                          </span>
                        );
                      })}
                    </span>
                    <svg className="w-4 h-4 text-[#999] group-hover:text-white shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <div className="flex items-center justify-between mt-4 text-sm border-t border-black pt-4">
          {page > 1 ? (
            <Link href={page === 2 ? basePath : `${basePath}?page=${page - 1}`} className="font-bold text-black hover:bg-black hover:text-white px-3 py-1 transition-colors border border-black">
              Previous
            </Link>
          ) : (
            <span className="text-[#ccc] px-3 py-1 border border-[#ccc]">Previous</span>
          )}
          <span className="text-[#555]">Page {page} of {totalPages}</span>
          {page < totalPages ? (
            <Link href={`${basePath}?page=${page + 1}`} className="font-bold text-black hover:bg-black hover:text-white px-3 py-1 transition-colors border border-black">
              Next
            </Link>
          ) : (
            <span className="text-[#ccc] px-3 py-1 border border-[#ccc]">Next</span>
          )}
        </div>
      )}
    </div>
  );
}
