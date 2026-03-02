"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { UserProfile } from "@arena/engine/users";

interface ChallengeInstance {
  id: string;
  name: string;
  createdAt: number;
  challengeType: string;
  invites: string[];
  instance?: {
    players: number;
    state?: {
      gameStarted?: boolean;
      gameEnded?: boolean;
      players: string[];
      playerIdentities?: Record<string, string>;
    };
  };
}

interface ChallengesListProps {
  challenges: ChallengeInstance[];
  challengeType: string;
  profiles?: Record<string, UserProfile>;
}

const formatDate = (timestamp: number) => {
  const d = new Date(timestamp);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${mm}/${dd} ${hh}:${min}`;
};

const getGameStatus = (challengeInstance: ChallengeInstance) => {
  const gameStarted = challengeInstance.instance?.state?.gameStarted ?? false;
  const gameEnded = challengeInstance.instance?.state?.gameEnded ?? false;
  const expectedPlayers = challengeInstance.instance?.players;
  const currentPlayers = challengeInstance.instance?.state?.players?.length;
  const waitingForPlayers = expectedPlayers && currentPlayers
    && currentPlayers > 0
    && currentPlayers < expectedPlayers;
  
  if (gameEnded) {
    return { 
      label: 'Ended', 
      dotColor: 'bg-zinc-500', 
      textColor: 'text-zinc-600',
      animate: false
    };
  } else if (gameStarted) {
    return { 
      label: 'Live', 
      dotColor: 'bg-green-500', 
      textColor: 'text-green-600',
      animate: true
    };
  } else if (waitingForPlayers) {
    return { 
      label: 'Waiting for players', 
      dotColor: 'bg-zinc-300', 
      textColor: 'text-zinc-500',
      animate: true
    };
  } else {
    return { 
      label: 'Not Started', 
      dotColor: 'bg-zinc-300', 
      textColor: 'text-zinc-500',
      animate: false
    };
  }
};

export default function ChallengesList({ challenges, challengeType, profiles = {} }: ChallengesListProps) {
  const router = useRouter();

  return (
    <div className="mt-12">
      <h2 className="text-2xl font-semibold text-zinc-900 mb-6" style={{ fontFamily: 'var(--font-jost), sans-serif' }}>
        Challenges ({challenges.length})
      </h2>
      {challenges.length === 0 ? (
        <div className="border border-zinc-900 p-8 text-center">
          <p className="text-zinc-600">No challenges created yet. Be the first to participate!</p>
        </div>
      ) : (
        <div className="border border-zinc-900 divide-y divide-zinc-100">
          {challenges.map((challengeInstance) => {
            const status = getGameStatus(challengeInstance);
            const players = challengeInstance.instance?.state?.gameEnded
              && challengeInstance.instance.state.playerIdentities
              ? Object.values(challengeInstance.instance.state.playerIdentities)
              : [];
            const challengeHref = `/challenges/${challengeType || challengeInstance.challengeType}/${challengeInstance.id}`;
            return (
              <div
                key={challengeInstance.id}
                onClick={() => router.push(challengeHref)}
                className="flex items-center px-5 py-4 hover:bg-zinc-50 transition-colors cursor-pointer"
              >
                <span className={`w-1.5 h-1.5 ${status.dotColor} rounded-full ${status.animate ? 'animate-pulse' : ''} shrink-0 mr-3 sm:hidden`}></span>
                <span className="w-[80px] text-sm text-zinc-400 font-mono shrink-0">
                  {challengeInstance.id.slice(0, 8)}
                </span>
                <span className={`w-[140px] max-sm:hidden text-sm ${status.textColor} flex items-center gap-2 font-medium shrink-0`}>
                  <span className={`w-1.5 h-1.5 ${status.dotColor} rounded-full ${status.animate ? 'animate-pulse' : ''}`}></span>
                  {status.label}
                </span>
                <span className="w-[100px] text-sm text-zinc-400 shrink-0">
                  {formatDate(challengeInstance.createdAt)}
                </span>
                <span className="text-sm text-zinc-600 truncate min-w-0 flex-1">
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
