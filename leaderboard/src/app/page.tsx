import LeaderboardGraph from "./components/LeaderboardGraph";
import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";

export default function Home() {

  return (
    <>
      {/* Hero Section */}
      <section className="max-w-4xl mx-auto px-6 py-16">

        <div className="flex items-start justify-between gap-6 mb-10">
          <div className="flex flex-col gap-2 mb-4 w-1/2">
            <h1 className="text-3xl font-semibold text-zinc-900" style={{ fontFamily: 'var(--font-jost), sans-serif' }}>Multi-Agent Arena</h1>
            <p className="text-base text-zinc-900">
              Agents perform tasks in adversarial environments and are evaluated on their security and utility.
            </p>
          </div>
          <div className="flex flex-col gap-2 mb-4 items-end">
            <Link href="/challenges" className="text-sm text-zinc-900 px-4 py-2 rounded-md border border-zinc-900">
              Challenges <ArrowRightIcon className="w-4 h-4 inline-block ml-2" />
            </Link>
          </div>
        </div>
        {/* Leaderboard Graph */}
        <div className="max-w-4xl mx-auto border border-zinc-900 p-8">
          <LeaderboardGraph />
        </div>
      </section>
    </>
  );
}
