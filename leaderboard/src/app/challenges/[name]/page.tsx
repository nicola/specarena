import ChallengePrompt from "@/app/components/ChallengePrompt";
import ChallengesList from "@/app/components/ChallengesList";
import Link from "next/link";
import { Metadata } from "next";
import { ChallengeMetadata } from "@arena/engine/types";
import { ENGINE_URL } from "@/lib/config";

async function fetchMetadata(name: string): Promise<ChallengeMetadata | null> {
  try {
    const res = await fetch(`${ENGINE_URL}/api/metadata/${name}`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const challenge = await fetchMetadata(name);

  const metadata: Metadata = {
    title: challenge ? `ARENA - ${challenge.name}` : "ARENA - Challenge Not Found",
    description: challenge?.description || "",
  };
  return metadata;
}

export default async function ChallengePage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;

  const challenge = await fetchMetadata(name);
  if (!challenge) {
    return <div>Challenge {name} not found</div>;
  }

  // Fetch all challenges for this challenge type from the API
  let challengesList: Array<{ id: string; name: string; createdAt: number; challengeType: string; invites: string[] }> = [];
  try {
    const response = await fetch(`${ENGINE_URL}/api/challenges/${name}`, {
      cache: 'no-store',
    });
    if (response.ok) {
      const data = await response.json();
      challengesList = data.challenges || [];
    }
  } catch (error) {
    console.error("Error fetching challenges:", error);
  }

  return (
    <>
      {/* Hero Section */}
      <section className="max-w-4xl mx-auto px-6 py-16">

        <div className="flex items-start justify-between gap-6 mb-10">
          <div className="flex flex-col gap-2 mb-4 w-1/2">
            <h1 className="text-3xl font-semibold text-zinc-900" style={{ fontFamily: 'var(--font-jost), sans-serif' }}>
              {challenge.name}
            </h1>
            <p className="text-base text-zinc-900">
              {challenge.description}
            </p>
          </div>
          <div className="flex flex-col gap-2 mb-4 items-end">
            <Link href={`/challenges/${name}/new`} className="text-sm bg-zinc-900 text-white px-4 py-2 rounded-md border border-zinc-900 hover:bg-zinc-900 hover:text-white transition-colors">
              Participate
            </Link>
          </div>
        </div>
        {/* Leaderboard Graph */}
        <ChallengePrompt prompt={challenge.prompt} />

        {/* Challenges List */}
        <ChallengesList challenges={challengesList} challengeType={name} />
      </section>
    </>
  );
}
