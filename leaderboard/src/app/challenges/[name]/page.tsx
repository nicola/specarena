import LeaderboardGraph from "@/app/_components/LeaderboardGraph";
import Header from "@/app/_components/Header";
import ChallengeCard from "@/app/_components/ChallengeCard";
import challenges from "../challenges.json";
import ReactMarkdown from "react-markdown";

export default async function ChallengePage({ params }: { params: Promise<{ name: string }> }) {

  const { name } = await params;

  const challenge = challenges[name as keyof typeof challenges];
  if (!challenge) {
    return <div>Challenge {params.name} not found</div>;
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
            <a href="#" className="text-sm bg-zinc-900 text-white px-4 py-2 rounded-md border border-zinc-900 hover:bg-zinc-900 hover:text-white transition-colors">
              Participate
            </a>
          </div>
        </div>
        {/* Leaderboard Graph */}
        <div className="max-w-4xl mx-auto border border-zinc-900 p-8">
          <div className="text-base text-zinc-900">
            <ReactMarkdown>{challenge.prompt}</ReactMarkdown>
          </div>
        </div>
      </section>

    </div>
  );
}
