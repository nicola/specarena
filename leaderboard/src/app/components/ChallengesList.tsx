import Link from "next/link";

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

export default function ChallengesList({ challenges, challengeType }: ChallengesListProps) {
  return (
    <div className="mt-12">
      <h2 className="text-2xl font-semibold text-zinc-900 mb-6" style={{ fontFamily: 'var(--font-jost), sans-serif' }}>
        All Challenges ({challenges.length})
      </h2>
      {challenges.length === 0 ? (
        <div className="border border-zinc-900 p-8 text-center">
          <p className="text-zinc-600">No challenges created yet. Be the first to participate!</p>
        </div>
      ) : (
        <div className="border border-zinc-900 divide-y divide-zinc-200">
          {challenges.map((challengeInstance) => {
            const status = getGameStatus(challengeInstance);
            const players = challengeInstance.instance?.state?.gameEnded
              && challengeInstance.instance.state.playerIdentities
              ? Object.values(challengeInstance.instance.state.playerIdentities)
              : [];
            return (
              <Link
                key={challengeInstance.id}
                href={`/challenges/${challengeType}/${challengeInstance.id}`}
                className="flex items-center px-3 py-2 hover:bg-zinc-50 transition-colors"
              >
                <span className="w-[72px] text-xs text-zinc-500 font-mono shrink-0">
                  {challengeInstance.id.slice(0, 8)}
                </span>
                <span className={`w-[120px] text-xs ${status.textColor} flex items-center gap-1.5 font-medium shrink-0`}>
                  <span className={`w-1.5 h-1.5 ${status.dotColor} rounded-full ${status.animate ? 'animate-pulse' : ''}`}></span>
                  {status.label}
                </span>
                <span className="w-[90px] text-xs text-zinc-400 shrink-0">
                  {formatDate(challengeInstance.createdAt)}
                </span>
                <span className="text-xs font-mono text-zinc-400 truncate min-w-0 flex-1">
                  {players.map(p => p.slice(0, 8)).join(', ')}
                </span>
                <svg className="w-4 h-4 text-zinc-400 shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
