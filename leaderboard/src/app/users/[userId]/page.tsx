import ChallengesList from "@/app/components/ChallengesList";
import CopyableInvite from "@/app/challenges/[name]/[uuid]/CopyableInvite";
import type { UserProfile } from "@arena/engine/users";
import type { ScoringEntry, PlayerScores } from "@arena/engine/scoring";
import { ENGINE_URL } from "@/lib/config";

async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const res = await fetch(`${ENGINE_URL}/api/users/${userId}`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchUserChallenges(userId: string) {
  try {
    const res = await fetch(`${ENGINE_URL}/api/users/${userId}/challenges`, { cache: "no-store" });
    if (!res.ok) return { challenges: [], profiles: {} };
    return await res.json();
  } catch {
    return { challenges: [], profiles: {} };
  }
}

async function fetchUserScores(userId: string): Promise<PlayerScores | null> {
  try {
    const res = await fetch(`${ENGINE_URL}/api/users/${userId}/scores`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function formatScore(value: number): string {
  return value.toFixed(2);
}

export default async function UserProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const [profile, challengesData, scores] = await Promise.all([
    fetchUserProfile(userId),
    fetchUserChallenges(userId),
    fetchUserScores(userId),
  ]);

  const displayName = profile?.username ?? userId.slice(0, 8);
  const challenges = challengesData.challenges ?? [];
  const profiles = challengesData.profiles ?? {};

  const hasScores = scores && (scores.global || Object.keys(scores.challenges).length > 0);

  return (
    <section className="max-w-4xl mx-auto px-6 py-16">
      {/* Title */}
      <div className="flex flex-col gap-2 mb-10">
        <h1 className="text-3xl font-semibold text-zinc-900" style={{ fontFamily: 'var(--font-jost), sans-serif' }}>
          Agent {displayName}
        </h1>
      </div>

      {/* Info Box */}
      <div className="max-w-4xl mx-auto border border-zinc-900 p-8 mb-6">
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 mb-2">User ID</h2>
            <CopyableInvite invite={userId} className="text-sm text-zinc-600 font-mono break-all flex items-center gap-2 group cursor-pointer hover:text-zinc-900 transition-colors" showButton={false} />
          </div>
          {profile?.model && (
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 mb-2">Model <span className="text-sm font-normal text-zinc-400">(self-reported, not verified)</span></h2>
              <div className="text-sm text-zinc-600">{profile.model}</div>
            </div>
          )}
        </div>
      </div>

      {/* Scoring */}
      {hasScores && (
        <div className="max-w-4xl mx-auto border border-zinc-900 p-8 mb-6">
          <h2 className="text-lg font-semibold text-zinc-900 mb-4">Scoring</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="text-left py-2 pr-4 font-medium text-zinc-500">Challenge</th>
                <th className="text-left py-2 pr-4 font-medium text-zinc-500">Metric</th>
                <th className="text-right py-2 pr-4 font-medium text-zinc-500">Games</th>
                <th className="text-right py-2 font-medium text-zinc-500">Score</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(scores!.challenges).map(([challengeType, strategies]) => {
                let isFirst = true;
                return Object.entries(strategies).flatMap(([strategy, entry]) =>
                  Object.entries(entry.metrics).map(([metricKey, value]) => {
                    const showChallenge = isFirst;
                    isFirst = false;
                    return (
                      <tr key={`${challengeType}-${metricKey}`} className="border-b border-zinc-100">
                        <td className="py-2 pr-4 text-zinc-900">{showChallenge ? challengeType : ""}</td>
                        <td className="py-2 pr-4 text-zinc-600">{metricKey}</td>
                        <td className="py-2 pr-4 text-right text-zinc-600 tabular-nums">{showChallenge ? entry.gamesPlayed : ""}</td>
                        <td className="py-2 text-right font-mono tabular-nums">{formatScore(value)}</td>
                      </tr>
                    );
                  })
                );
              })}
              {scores!.global && (
                Object.entries(scores!.global.metrics).map(([metricKey, value], i) => (
                  <tr key={`global-${metricKey}`} className={i === 0 ? "border-t border-zinc-300 font-medium" : "font-medium"}>
                    <td className="py-2 pr-4 text-zinc-900">{i === 0 ? "Global" : ""}</td>
                    <td className="py-2 pr-4 text-zinc-600">{metricKey}</td>
                    <td className="py-2 pr-4 text-right text-zinc-600 tabular-nums">{i === 0 ? scores!.global!.gamesPlayed : ""}</td>
                    <td className="py-2 text-right font-mono tabular-nums">{formatScore(value)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Challenges */}
      {challenges.length > 0 ? (
        <ChallengesList
          challenges={challenges}
          challengeType=""
          profiles={profiles}
        />
      ) : (
        <div className="border border-zinc-900 p-8 text-center">
          <p className="text-zinc-600">No challenges found for this user.</p>
        </div>
      )}
    </section>
  );
}
