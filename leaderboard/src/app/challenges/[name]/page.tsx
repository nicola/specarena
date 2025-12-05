import Header from "@/app/_components/Header";
import ChallengePrompt from "@/app/_components/ChallengePrompt";
import ChallengesList from "@/app/_components/ChallengesList";
import challenges from "@/app/_challenges/challenges.json";
import Link from "next/link";
import { Metadata } from "next";
import { headers } from "next/headers";

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const challenge = challenges[name as keyof typeof challenges];
  if (!challenge) {
    return { title: "Challenge not found" };
  }

  const metadata: Metadata = {
    title: `ARENA - ${challenge.name}`,
    description: challenge.description,
  };
  return metadata;
}

export default async function ChallengePage({ params }: { params: Promise<{ name: string }> }) {

  const { name } = await params;

  const challenge = challenges[name as keyof typeof challenges];
  if (!challenge) {
    return <div>Challenge {name} not found</div>;
  }

  // Fetch all challenges for this challenge type from the API
  let challengesList: Array<{ id: string; name: string; createdAt: number; challengeType: string; invites: string[] }> = [];
  try {
    const headersList = await headers();
    const host = headersList.get("host") || "";
    const protocol = headersList.get("x-forwarded-proto") || "http";
    const baseUrl = `${protocol}://${host}`;
    
    const response = await fetch(`${baseUrl}/api/challenges/${name}`, {
      cache: 'no-store', // Always fetch fresh data
    });
    if (response.ok) {
      const data = await response.json();
      challengesList = data.challenges || [];
    }
  } catch (error) {
    console.error("Error fetching challenges:", error);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white">
      <Header />

      {/* Hero Section */}
      <section className="max-w-4xl mx-auto px-6 py-16">

        <div className="flex items-top justify-between gap-6 mb-10">
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

    </div>
  );
}
