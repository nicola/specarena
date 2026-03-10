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
  const { status, players = [] } = c.state ?? {};
  const waitingForPlayers = status === ChallengeStatus.Open && players.length > 0 && players.length < c.invites.length;
  if (status === ChallengeStatus.Ended)
    return { label: "Ended", dotColor: "#adb5bd", textColor: "#6c757d", animate: false };
  if (status === ChallengeStatus.Active)
    return { label: "Live", dotColor: "#198754", textColor: "#198754", animate: true };
  if (waitingForPlayers)
    return { label: "Waiting", dotColor: "#ffc107", textColor: "#856404", animate: true };
  return { label: "Not Started", dotColor: "#dee2e6", textColor: "#6c757d", animate: false };
};

export default function ChallengesList({ challenges, challengeType, profiles = {}, total, page = 1, pageSize = 50, basePath, subtitle }: ChallengesListProps) {
  const router = useRouter();
  const displayTotal = total ?? challenges.length;
  const totalPages = pageSize > 0 ? Math.ceil(displayTotal / pageSize) : 1;
  const hasPagination = basePath && totalPages > 1;

  return (
    <div className="mt-6">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="font-semibold" style={{ color: '#212529', fontSize: '14px' }}>
          Games
        </h2>
        {subtitle && <div style={{ color: '#6c757d', fontSize: '12px' }}>{subtitle}</div>}
      </div>
      {challenges.length === 0 ? (
        <div className="px-3 py-4 text-center" style={{ border: '1px solid #dee2e6', color: '#6c757d', fontSize: '12px' }}>
          No games yet. Be the first to participate!
        </div>
      ) : (
        <div style={{ border: '1px solid #dee2e6' }}>
          {/* Header row */}
          <div className="flex items-center px-3 py-1" style={{ background: '#f8f9fa', borderBottom: '1px solid #dee2e6', fontSize: '11px', color: '#6c757d', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            <span className="w-[68px] shrink-0 max-sm:hidden">ID</span>
            <span className="w-[90px] shrink-0 max-sm:hidden">Status</span>
            <span className="w-[90px] shrink-0 max-sm:hidden">Date</span>
            <span className="min-w-0 flex-1">Player</span>
            <span className="w-[52px] text-right shrink-0"><span className="max-sm:hidden">Utility</span><span className="sm:hidden">U</span></span>
            <span className="w-[52px] text-right shrink-0 ml-1"><span className="max-sm:hidden">Security</span><span className="sm:hidden">S</span></span>
            <span className="w-3 ml-1.5 shrink-0 max-sm:hidden"></span>
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
                className="flex items-start px-3 py-1.5 cursor-pointer transition-colors"
                style={{ borderBottom: '1px solid #f1f3f5', fontSize: '12px' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f8f9fa')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                {/* Mobile dot */}
                <span className="sm:hidden shrink-0 mr-2 mt-1.5" style={{ width: '6px', height: '6px', borderRadius: '50%', background: status.dotColor, flexShrink: 0, display: 'inline-block', animation: status.animate ? 'pulse 2s infinite' : 'none' }}></span>
                {/* ID */}
                <span className="w-[68px] shrink-0 font-mono max-sm:hidden" style={{ color: '#adb5bd', fontSize: '11px' }}>
                  {challengeInstance.id.slice(0, 8)}
                </span>
                {/* Status badge */}
                <span className="w-[90px] shrink-0 max-sm:hidden flex items-center gap-1.5 font-medium" style={{ color: status.textColor }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: status.dotColor, display: 'inline-block', flexShrink: 0 }}></span>
                  {status.label}
                </span>
                {/* Date */}
                <span className="w-[90px] shrink-0 max-sm:hidden" style={{ color: '#adb5bd' }}>
                  {formatDate(challengeInstance.createdAt)}
                </span>
                {/* Players + scores */}
                {players.length > 0 && challengeInstance.state?.scores ? (
                  <div className="min-w-0 flex-1">
                    <span className="sm:hidden font-mono block" style={{ color: '#adb5bd', fontSize: '11px' }}>{challengeInstance.id.slice(0, 8)}</span>
                    {players.map((p, i) => {
                      const name = profiles[p]?.username;
                      const short = p.slice(0, 8);
                      const score = challengeInstance.state?.scores?.[i];
                      const scores = challengeInstance.state?.scores;
                      const didBreach = scores?.some((s, j) => j !== i && s.security === -1);
                      return (
                        <div key={i} className="flex items-center leading-tight">
                          <span className="min-w-0 flex-1 truncate" style={{ color: '#495057' }}>
                            <Link
                              href={`/users/${p}`}
                              onClick={(e) => e.stopPropagation()}
                              className="hover:underline"
                              style={{ color: '#0d6efd' }}
                            >
                              {name ?? short}
                            </Link>
                            {name && <span style={{ color: '#adb5bd' }}> ({short})</span>}
                            {didBreach && <FireIcon className="inline-block w-2.5 h-2.5 ml-1" style={{ color: '#dc3545' }} />}
                          </span>
                          <span className="w-[52px] text-right shrink-0 font-mono" style={{ color: score?.utility === -1 ? '#6f42c1' : '#6c757d', fontSize: '11px' }}>{score?.utility ?? '–'}</span>
                          <span className="w-[52px] text-right shrink-0 font-mono ml-1" style={{ color: score?.security === -1 ? '#dc3545' : '#6c757d', fontSize: '11px' }}>{score?.security ?? '–'}</span>
                          <span className="w-3 ml-1.5 shrink-0 max-sm:hidden"></span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate" style={{ color: '#495057' }}>
                      <span className="sm:hidden font-mono block" style={{ color: '#adb5bd', fontSize: '11px' }}>{challengeInstance.id.slice(0, 8)}</span>
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
                              style={{ color: '#0d6efd' }}
                            >
                              {name ?? short}
                            </Link>
                            {name && <span style={{ color: '#adb5bd' }}> ({short})</span>}
                          </span>
                        );
                      })}
                    </span>
                    <svg className="w-3 h-3 shrink-0 ml-1.5 max-sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#dee2e6' }}>
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
        <div className="flex items-center justify-between mt-2" style={{ fontSize: '12px' }}>
          {page > 1 ? (
            <Link href={page === 2 ? basePath : `${basePath}?page=${page - 1}`} style={{ color: '#0d6efd' }} className="hover:underline">
              Previous
            </Link>
          ) : (
            <span style={{ color: '#dee2e6' }}>Previous</span>
          )}
          <span style={{ color: '#6c757d' }}>Page {page} of {totalPages}</span>
          {page < totalPages ? (
            <Link href={`${basePath}?page=${page + 1}`} style={{ color: '#0d6efd' }} className="hover:underline">
              Next
            </Link>
          ) : (
            <span style={{ color: '#dee2e6' }}>Next</span>
          )}
        </div>
      )}
    </div>
  );
}
