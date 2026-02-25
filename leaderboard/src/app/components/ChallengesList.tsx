import Link from "next/link";
import { ChallengeListItem } from "@arena/engine/types";

interface ChallengesListProps {
  challenges: ChallengeListItem[];
  challengeType: string;
}

const formatDate = (timestamp: number) => {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getGameStatus = (challengeInstance: ChallengeListItem) => {
  const gameStarted = challengeInstance.state.gameStarted;
  const gameEnded = challengeInstance.state.gameEnded;
  const expectedPlayers = challengeInstance.state.expectedPlayers;
  const currentPlayers = challengeInstance.state.joinedPlayers;
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
        <div className="space-y-4">
          {challenges.map((challengeInstance) => (
            <Link
              key={challengeInstance.id}
              href={`/challenges/${challengeType}/${challengeInstance.id}`}
              className="block border border-zinc-900 p-6 hover:bg-zinc-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-zinc-500 font-mono">
                      {challengeInstance.id}
                    </span>
                    {(() => {
                      const status = getGameStatus(challengeInstance);
                      return (
                        <span className={`text-xs ${status.textColor} flex items-center gap-1.5 font-medium`}>
                          <span className={`w-2 h-2 ${status.dotColor} rounded-full ${status.animate ? 'animate-pulse' : ''}`}></span>
                          {status.label}
                        </span>
                      );
                    })()}
                  </div>
                  <p className="text-sm text-zinc-600 text-xs">
                    Created {formatDate(challengeInstance.createdAt)}
                  </p>
                  {challengeInstance.state.gameEnded && challengeInstance.state.playerIdentities && Object.keys(challengeInstance.state.playerIdentities).length > 0 && (
                    <div className="flex gap-2 mt-1">
                      {Object.values(challengeInstance.state.playerIdentities).map((id, idx) => (
                        <span key={idx} className="text-xs font-mono text-zinc-400" title={id}>
                          {id.slice(0, 8)}...
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-zinc-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
