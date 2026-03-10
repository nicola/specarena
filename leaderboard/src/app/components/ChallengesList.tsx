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
    return { label: "ENDED", sigil: ".", color: "text-[#006600]", animate: false };
  if (status === ChallengeStatus.Active)
    return { label: "LIVE", sigil: "*", color: "text-[#00ff00]", animate: true };
  if (waitingForPlayers)
    return { label: "WAITING", sigil: "~", color: "text-[#ffaa00]", animate: true };
  return { label: "PENDING", sigil: "-", color: "text-[#006600]", animate: false };
};

export default function ChallengesList({ challenges, challengeType, profiles = {}, total, page = 1, pageSize = 50, basePath, subtitle }: ChallengesListProps) {
  const router = useRouter();
  const displayTotal = total ?? challenges.length;
  const totalPages = pageSize > 0 ? Math.ceil(displayTotal / pageSize) : 1;
  const hasPagination = basePath && totalPages > 1;

  return (
    <div className="mt-8 font-mono text-[#00ff00]">
      {/* ps aux style header */}
      <div className="text-[#006600] text-xs mb-1">$ arena ps --all</div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[#00ff00] font-bold text-sm">PROCESS LIST</span>
        {subtitle && <div className="text-xs text-[#006600]">{subtitle}</div>}
      </div>

      {challenges.length === 0 ? (
        <div className="border border-[#00ff00] p-6 text-center">
          <p className="text-[#006600] text-sm">-- no processes found. be the first to participate --</p>
        </div>
      ) : (
        <div className="border border-[#00ff00]">
          {/* Column headers — ps aux style */}
          <div className="flex items-center px-3 py-1.5 text-xs text-[#006600] border-b border-[#003300] bg-[#001100] uppercase">
            <span className="w-[80px] max-sm:hidden shrink-0">PID</span>
            <span className="w-[80px] max-sm:hidden shrink-0">STAT</span>
            <span className="w-[100px] shrink-0 max-sm:hidden">START</span>
            <span className="min-w-0 flex-1">USER</span>
            <span className="w-[60px] max-sm:w-[36px] text-right shrink-0 pl-2"><span className="max-sm:hidden">UTIL</span><span className="sm:hidden">U</span></span>
            <span className="w-[60px] max-sm:w-[36px] max-sm:mr-1 text-right shrink-0 pl-2"><span className="max-sm:hidden">SEC</span><span className="sm:hidden">S</span></span>
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
                className="flex items-start px-3 py-2 hover:bg-[#001100] transition-colors cursor-pointer border-b border-[#002200] last:border-b-0"
              >
                {/* Mobile status sigil */}
                <span className={`w-4 mt-[3px] text-xs shrink-0 mr-2 sm:hidden ${status.color} ${status.animate ? 'animate-pulse' : ''}`}>
                  {status.sigil}
                </span>

                {/* PID */}
                <span className="w-[80px] text-xs text-[#006600] font-mono shrink-0 max-sm:hidden">
                  {challengeInstance.id.slice(0, 8)}
                </span>

                {/* STAT */}
                <span className={`w-[80px] max-sm:hidden text-xs ${status.color} font-mono shrink-0 ${status.animate ? 'animate-pulse' : ''}`}>
                  {status.sigil} {status.label}
                </span>

                {/* START */}
                <span className="w-[100px] text-xs text-[#006600] shrink-0 max-sm:hidden">
                  {formatDate(challengeInstance.createdAt)}
                </span>

                {players.length > 0 && challengeInstance.state?.scores ? (
                  <div className="min-w-0 flex-1">
                    <span className="sm:hidden text-xs text-[#006600] font-mono block leading-tight mb-0.5">{challengeInstance.id.slice(0, 8)}</span>
                    {players.map((p, i) => {
                      const name = profiles[p]?.username;
                      const short = p.slice(0, 8);
                      const score = challengeInstance.state?.scores?.[i];
                      const scores = challengeInstance.state?.scores;
                      const didBreach = scores?.some((s, j) => j !== i && s.security === -1);
                      return (
                        <div key={i} className="flex items-center leading-tight">
                          <span className="text-xs text-[#00aa00] min-w-0 flex-1 truncate">
                            <Link
                              href={`/users/${p}`}
                              onClick={(e) => e.stopPropagation()}
                              className="hover:text-[#00ff00]"
                            >
                              {name ?? short}{name && <span className="text-[#006600]"> ({short})</span>}
                            </Link>
                            {didBreach && <span className="ml-1 text-[#ff4444] text-xs">[BREACH]</span>}
                          </span>
                          <span className={`w-[60px] max-sm:w-[36px] text-right text-xs font-mono shrink-0 pl-2 ${score?.utility === -1 ? 'text-[#aa44ff]' : 'text-[#006600]'}`}>
                            {score?.utility ?? '--'}
                          </span>
                          <span className={`w-[60px] max-sm:w-[36px] max-sm:mr-1 text-right text-xs font-mono shrink-0 pl-2 ${score?.security === -1 ? 'text-[#ff4444]' : 'text-[#006600]'}`}>
                            {score?.security ?? '--'}
                          </span>
                          <span className="w-4 ml-2 shrink-0 max-sm:hidden"></span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <>
                    <span className="text-xs text-[#00aa00] min-w-0 flex-1 truncate">
                      <span className="sm:hidden text-xs text-[#006600] font-mono block leading-tight mb-0.5">{challengeInstance.id.slice(0, 8)}</span>
                      {players.map((p, i) => {
                        const name = profiles[p]?.username;
                        const short = p.slice(0, 8);
                        return (
                          <span key={i}>
                            {i > 0 && ', '}
                            <Link
                              href={`/users/${p}`}
                              onClick={(e) => e.stopPropagation()}
                              className="hover:text-[#00ff00]"
                            >
                              {name ?? short}{name && <span className="text-[#006600]"> ({short})</span>}
                            </Link>
                          </span>
                        );
                      })}
                    </span>
                    <span className="text-[#006600] shrink-0 ml-2 text-xs">&gt;</span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {hasPagination && (
        <div className="flex items-center justify-between mt-3 text-xs text-[#006600]">
          {page > 1 ? (
            <Link href={page === 2 ? basePath : `${basePath}?page=${page - 1}`} className="hover:text-[#00ff00]">
              [prev]
            </Link>
          ) : (
            <span className="text-[#003300]">[prev]</span>
          )}
          <span>page {page}/{totalPages}</span>
          {page < totalPages ? (
            <Link href={`${basePath}?page=${page + 1}`} className="hover:text-[#00ff00]">
              [next]
            </Link>
          ) : (
            <span className="text-[#003300]">[next]</span>
          )}
        </div>
      )}
    </div>
  );
}
