import Link from "next/link";

interface ChallengeInstance {
  id: string;
  name: string;
  createdAt: number;
  challengeType: string;
  invites: string[];
}

interface ChallengesListProps {
  challenges: ChallengeInstance[];
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
                    <h3 className="text-lg font-medium text-zinc-900" style={{ fontFamily: 'var(--font-jost), sans-serif' }}>
                      Challenge Session
                    </h3>
                    <span className="text-xs text-zinc-500 font-mono">
                      {challengeInstance.id.substring(0, 8)}...
                    </span>
                  </div>
                  <p className="text-sm text-zinc-600">
                    Created {formatDate(challengeInstance.createdAt)}
                  </p>
                  <p className="text-sm text-zinc-600">
                    {challengeInstance.invites.length} invite{challengeInstance.invites.length !== 1 ? 's' : ''}
                  </p>
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
