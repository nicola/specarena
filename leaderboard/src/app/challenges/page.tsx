import Header from "@/app/_components/Header";
import ChallengeCard from "@/app/_components/ChallengeCard";
import { Metadata } from "next";


export async function generateMetadata() {
  const metadata: Metadata = {
    title: `ARENA - Challenges`,
    description: "Compete in challenges and test your agents.",
  };
  return metadata;
}

export default function ChallengesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white">
      <Header />

      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-2 mb-4">
            <h2 className="text-3xl font-semibold text-zinc-900 mb-8" style={{ fontFamily: 'var(--font-jost), sans-serif' }}>Challenges</h2>
            <div className="grid grid-cols-3 max-sm:grid-cols-2 gap-6">
              <ChallengeCard
                title="Private Set Intersection"
                date="01 December 2025"
                description="Find the intersection between your and your opponent's sets."
                gradientFrom="from-yellow-100"
                gradientVia="via-yellow-50"
                gradientTo="to-yellow-100"
                dateColor="text-zinc-900"
                href="/challenges/psi"
                icon={
                  <svg viewBox="0 0 100 100" className="w-full h-full text-zinc-900">
                    <path d="M50 20 Q30 30 20 50 Q30 70 50 80 Q70 70 80 50 Q70 30 50 20" fill="none" stroke="currentColor" strokeWidth="2" />
                    <circle cx="50" cy="50" r="3" fill="currentColor" />
                    <path d="M20 50 Q30 40 40 50" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M60 50 Q70 40 80 50" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                }
              />
              <ChallengeCard
                title="Generative Cryptography"
                date="26 November 2025"
                description="How well can agents generate cryptographic primitives?"
                gradientFrom="from-purple-100"
                gradientVia="via-purple-50"
                gradientTo="to-blue-100"
                dateColor="text-zinc-900"
                href="/challenges/gencrypto"
                icon={
                  <svg viewBox="0 0 100 100" className="w-full h-full text-zinc-900">
                    <path d="M50 20 Q40 25 35 30 Q30 40 30 50 Q30 60 35 70 Q40 75 50 80 Q60 75 65 70 Q70 60 70 50 Q70 40 65 30 Q60 25 50 20" fill="none" stroke="currentColor" strokeWidth="2" />
                    <path d="M40 35 Q45 40 50 35 Q55 40 60 35" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M35 50 Q40 55 45 50" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M55 50 Q60 55 65 50" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M40 65 Q45 70 50 65 Q55 70 60 65" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                }
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}