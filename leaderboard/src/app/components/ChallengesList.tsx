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
    return { label: "Concluded", dotColor: "bg-[#8c7a5e]", textColor: "text-[#6b5a44]", animate: false };
  if (status === ChallengeStatus.Active)
    return { label: "Active", dotColor: "bg-[#2d6a4f]", textColor: "text-[#2d6a4f]", animate: true };
  if (waitingForPlayers)
    return { label: "Awaiting Participants", dotColor: "bg-[#b8860b]", textColor: "text-[#b8860b]", animate: true };
  return { label: "Pending", dotColor: "bg-[#c4b49a]", textColor: "text-[#8c7a5e]", animate: false };
};

export default function ChallengesList({ challenges, challengeType, profiles = {}, total, page = 1, pageSize = 50, basePath, subtitle }: ChallengesListProps) {
  const router = useRouter();
  const displayTotal = total ?? challenges.length;
  const totalPages = pageSize > 0 ? Math.ceil(displayTotal / pageSize) : 1;
  const hasPagination = basePath && totalPages > 1;

  return (
    <div className="mt-12">
      <h2 className="text-2xl text-[#1a3a5c] mb-2" style={{ fontFamily: 'var(--font-eb-garamond), Georgia, serif', fontVariant: 'small-caps' }}>
        Session Records
      </h2>
      {subtitle && <div className="mt-1 mb-6 text-sm text-[#6b5a44]" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>{subtitle}</div>}
      {challenges.length === 0 ? (
        <div className="border border-[#d4c9b0] bg-white p-8 text-center" style={{ borderLeft: '3px solid #1a3a5c' }}>
          <p className="text-[#6b5a44] italic" style={{ fontFamily: 'var(--font-eb-garamond), Georgia, serif' }}>No sessions recorded. Be the first to participate.</p>
        </div>
      ) : (
        <div className="bg-white" style={{ borderTop: '2px solid #1a3a5c', borderBottom: '2px solid #1a3a5c' }}>
          {/* Table header */}
          <div className="flex items-center px-5 py-2 text-xs text-[#1a3a5c] tracking-wider border-b border-[#1a3a5c]"
            style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif', fontVariant: 'small-caps', letterSpacing: '0.08em', background: '#f5f0e8' }}>
            <span className="w-[80px] max-sm:hidden shrink-0">Record ID</span>
            <span className="w-[140px] max-sm:hidden shrink-0">Status</span>
            <span className="w-[100px] shrink-0 max-sm:hidden">Date</span>
            <span className="min-w-0 flex-1">Participant</span>
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
                className="flex items-start px-5 py-3 cursor-pointer transition-colors"
                style={{
                  borderBottom: '1px solid #e8dfd0',
                  background: idx % 2 === 0 ? '#ffffff' : '#faf7f2',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f5efe3')}
                onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? '#ffffff' : '#faf7f2')}
              >
                <span className={`w-1.5 h-1.5 mt-[7px] ${status.dotColor} rounded-full ${status.animate ? 'animate-pulse' : ''} shrink-0 mr-3 sm:hidden`}></span>
                <span className="w-[80px] text-xs text-[#8c7a5e] font-mono shrink-0 max-sm:hidden" style={{ fontFamily: 'var(--font-ibm-plex-sans), monospace' }}>
                  {challengeInstance.id.slice(0, 8)}
                </span>
                <span className={`w-[140px] max-sm:hidden text-xs ${status.textColor} flex items-center gap-2 shrink-0`} style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>
                  <span className={`w-1.5 h-1.5 ${status.dotColor} rounded-full ${status.animate ? 'animate-pulse' : ''}`}></span>
                  {status.label}
                </span>
                <span className="w-[100px] text-xs text-[#8c7a5e] shrink-0 max-sm:hidden" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>
                  {formatDate(challengeInstance.createdAt)}
                </span>
                {players.length > 0 && challengeInstance.state?.scores ? (
                  <div className="min-w-0 flex-1">
                    <span className="sm:hidden text-xs text-[#8c7a5e] font-mono block leading-tight mt-0.5">{challengeInstance.id.slice(0, 8)}</span>
                    {players.map((p, i) => {
                      const name = profiles[p]?.username;
                      const short = p.slice(0, 8);
                      const score = challengeInstance.state?.scores?.[i];
                      const scores = challengeInstance.state?.scores;
                      const didBreach = scores?.some((s, j) => j !== i && s.security === -1);
                      return (
                        <div key={i} className="flex items-center leading-tight">
                          <span className="text-sm text-[#2c2c2c] min-w-0 flex-1 truncate" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>
                            <Link
                              href={`/users/${p}`}
                              onClick={(e) => e.stopPropagation()}
                              className="hover:text-[#1a3a5c] hover:underline"
                            >
                              {name ?? short}{name && <span className="text-[#8c7a5e]"> ({short})</span>}
                            </Link>
                            {didBreach && <FireIcon className="inline-block w-3 h-3 ml-1 text-red-400" />}
                          </span>
                          <span className={`w-[70px] max-sm:w-[40px] text-right text-xs font-mono shrink-0 pl-3 max-sm:pl-1 ${score?.utility === -1 ? 'text-violet-500' : 'text-[#6b5a44]'}`}>{score?.utility ?? '–'}</span>
                          <span className={`w-[70px] max-sm:w-[40px] max-sm:mr-1 text-right text-xs font-mono shrink-0 pl-3 max-sm:pl-1 ${score?.security === -1 ? 'text-red-500' : 'text-[#6b5a44]'}`}>{score?.security ?? '–'}</span>
                          <span className="w-4 ml-2 shrink-0 max-sm:hidden"></span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <>
                    <span className="text-sm text-[#2c2c2c] min-w-0 flex-1 truncate" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>
                      <span className="sm:hidden text-xs text-[#8c7a5e] font-mono block leading-tight mt-0.5">{challengeInstance.id.slice(0, 8)}</span>
                      {players.map((p, i) => {
                        const name = profiles[p]?.username;
                        const short = p.slice(0, 8);
                        return (
                          <span key={i}>
                            {i > 0 && ', '}
                            <Link
                              href={`/users/${p}`}
                              onClick={(e) => e.stopPropagation()}
                              className="hover:text-[#1a3a5c] hover:underline"
                            >
                              {name ?? short}{name && <span className="text-[#8c7a5e]"> ({short})</span>}
                            </Link>
                          </span>
                        );
                      })}
                    </span>
                    <svg className="w-4 h-4 text-[#c4b49a] shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <div className="flex items-center justify-between mt-4 text-sm" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>
          {page > 1 ? (
            <Link href={page === 2 ? basePath : `${basePath}?page=${page - 1}`} className="text-[#1a3a5c] hover:underline">
              ← Previous
            </Link>
          ) : (
            <span className="text-[#c4b49a]">← Previous</span>
          )}
          <span className="text-[#8c7a5e] text-xs" style={{ fontVariant: 'small-caps' }}>Page {page} of {totalPages}</span>
          {page < totalPages ? (
            <Link href={`${basePath}?page=${page + 1}`} className="text-[#1a3a5c] hover:underline">
              Next →
            </Link>
          ) : (
            <span className="text-[#c4b49a]">Next →</span>
          )}
        </div>
      )}
    </div>
  );
}
