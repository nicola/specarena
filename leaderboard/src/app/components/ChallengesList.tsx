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
    return { label: "ENDED", dotColor: "bg-gray-500", textColor: "text-gray-600", animate: false };
  if (status === ChallengeStatus.Active)
    return { label: "LIVE", dotColor: "bg-green-500", textColor: "text-green-700 font-black", animate: true };
  if (waitingForPlayers)
    return { label: "WAITING", dotColor: "bg-yellow-400", textColor: "text-yellow-700", animate: true };
  return { label: "NOT STARTED", dotColor: "bg-gray-400", textColor: "text-gray-500", animate: false };
};

export default function ChallengesList({ challenges, challengeType, profiles = {}, total, page = 1, pageSize = 50, basePath, subtitle }: ChallengesListProps) {
  const router = useRouter();
  const displayTotal = total ?? challenges.length;
  const totalPages = pageSize > 0 ? Math.ceil(displayTotal / pageSize) : 1;
  const hasPagination = basePath && totalPages > 1;

  return (
    <div className="mt-12">
      <h2 className="text-4xl font-black uppercase tracking-tight mb-2" style={{ fontFamily: "'Arial Black', Arial, sans-serif" }}>
        GAMES
      </h2>
      {subtitle && <div className="mt-1 mb-6">{subtitle}</div>}
      {challenges.length === 0 ? (
        <div className="border-4 border-black p-8 text-center" style={{ boxShadow: '6px 6px 0 #000' }}>
          <p className="font-black uppercase tracking-wide">NO GAMES YET. BE THE FIRST TO PARTICIPATE.</p>
        </div>
      ) : (
        <div className="border-4 border-black" style={{ boxShadow: '6px 6px 0 #000' }}>
          {/* Header row */}
          <div className="flex items-center px-5 py-3 text-xs font-black uppercase tracking-widest border-b-4 border-black bg-black text-white">
            <span className="w-[80px] max-sm:hidden shrink-0">ID</span>
            <span className="w-[140px] max-sm:hidden shrink-0">STATUS</span>
            <span className="w-[100px] shrink-0 max-sm:hidden">DATE</span>
            <span className="min-w-0 flex-1">PLAYER</span>
            <span className="w-[70px] max-sm:w-[40px] text-right shrink-0 pl-3 max-sm:pl-1"><span className="max-sm:hidden">UTILITY</span><span className="sm:hidden">U</span></span>
            <span className="w-[70px] max-sm:w-[40px] max-sm:mr-1 text-right shrink-0 pl-3 max-sm:pl-1"><span className="max-sm:hidden">SECURITY</span><span className="sm:hidden">S</span></span>
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
                className="flex items-start px-5 py-4 cursor-pointer border-t-2 border-black hover:bg-black hover:text-white transition-none"
                style={{ borderTopWidth: idx === 0 ? 0 : undefined }}
              >
                <span className={`w-1.5 h-1.5 mt-[7px] ${status.dotColor} ${status.animate ? 'animate-pulse' : ''} shrink-0 mr-3 sm:hidden`}></span>
                <span className="w-[80px] text-sm font-mono font-bold shrink-0 max-sm:hidden">
                  {challengeInstance.id.slice(0, 8)}
                </span>
                <span className={`w-[140px] max-sm:hidden text-sm ${status.textColor} flex items-center gap-2 font-black shrink-0`}>
                  <span className={`w-1.5 h-1.5 ${status.dotColor} ${status.animate ? 'animate-pulse' : ''}`}></span>
                  {status.label}
                </span>
                <span className="w-[100px] text-sm font-bold shrink-0 max-sm:hidden">
                  {formatDate(challengeInstance.createdAt)}
                </span>
                {players.length > 0 && challengeInstance.state?.scores ? (
                  <div className="min-w-0 flex-1">
                    <span className="sm:hidden text-xs font-mono font-bold block leading-tight mt-0.5">{challengeInstance.id.slice(0, 8)}</span>
                    {players.map((p, i) => {
                      const name = profiles[p]?.username;
                      const short = p.slice(0, 8);
                      const score = challengeInstance.state?.scores?.[i];
                      const scores = challengeInstance.state?.scores;
                      const didBreach = scores?.some((s, j) => j !== i && s.security === -1);
                      return (
                        <div key={i} className="flex items-center leading-tight">
                          <span className="text-sm font-bold min-w-0 flex-1 truncate uppercase">
                            <Link
                              href={`/users/${p}`}
                              onClick={(e) => e.stopPropagation()}
                              className="hover:underline"
                            >
                              {name ?? short}{name && <span className="opacity-50 text-xs"> ({short})</span>}
                            </Link>
                            {didBreach && <FireIcon className="inline-block w-3 h-3 ml-1" style={{ color: '#ff0000' }} />}
                          </span>
                          <span className={`w-[70px] max-sm:w-[40px] text-right text-xs font-mono font-black shrink-0 pl-3 max-sm:pl-1 ${score?.utility === -1 ? 'text-red-600' : ''}`}>{score?.utility ?? '–'}</span>
                          <span className={`w-[70px] max-sm:w-[40px] max-sm:mr-1 text-right text-xs font-mono font-black shrink-0 pl-3 max-sm:pl-1 ${score?.security === -1 ? 'text-red-600' : ''}`}>{score?.security ?? '–'}</span>
                          <span className="w-4 ml-2 shrink-0 max-sm:hidden"></span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <>
                    <span className="text-sm font-bold min-w-0 flex-1 truncate uppercase">
                      <span className="sm:hidden text-xs font-mono block leading-tight mt-0.5">{challengeInstance.id.slice(0, 8)}</span>
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
                              {name ?? short}{name && <span className="opacity-50"> ({short})</span>}
                            </Link>
                          </span>
                        );
                      })}
                    </span>
                    <svg className="w-4 h-4 shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
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
            <Link href={page === 2 ? basePath : `${basePath}?page=${page - 1}`} className="brutal-btn text-xs py-2 px-4">
              ← PREVIOUS
            </Link>
          ) : (
            <span className="text-sm font-black uppercase opacity-30">← PREVIOUS</span>
          )}
          <span className="text-xs font-black uppercase tracking-widest">PAGE {page} / {totalPages}</span>
          {page < totalPages ? (
            <Link href={`${basePath}?page=${page + 1}`} className="brutal-btn text-xs py-2 px-4">
              NEXT →
            </Link>
          ) : (
            <span className="text-sm font-black uppercase opacity-30">NEXT →</span>
          )}
        </div>
      )}
    </div>
  );
}
