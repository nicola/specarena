import ChallengesList from "@/app/components/ChallengesList";
import CopyableInvite from "@/app/challenges/[name]/[uuid]/CopyableInvite";
import type { UserProfile } from "@arena/engine/users";
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

export default async function UserProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const [profile, challengesData] = await Promise.all([
    fetchUserProfile(userId),
    fetchUserChallenges(userId),
  ]);

  const displayName = profile?.username ?? userId.slice(0, 8);
  const challenges = challengesData.challenges ?? [];
  const profiles = challengesData.profiles ?? {};

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
