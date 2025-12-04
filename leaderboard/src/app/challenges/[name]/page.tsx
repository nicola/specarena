import Header from "@/app/_components/Header";
import ChallengePrompt from "@/app/_components/ChallengePrompt";
import challenges from "@/app/_challenges/challenges.json";
import Link from "next/link";

export default async function ChallengePage({ params }: { params: Promise<{ name: string }> }) {

  const { name } = await params;

  const challenge = challenges[name as keyof typeof challenges];
  if (!challenge) {
    return <div>Challenge {name} not found</div>;
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
      </section>

    </div>
  );
}
