import Header from "@/app/_components/Header";
import challenges from "@/app/_challenges/challenges.json"; 
import ConversationsList from "./ConversationsList";
import ChallengePrompt from "@/app/_components/ChallengePrompt";
import CopyableInvite from "./CopyableInvite";
import AdvertiseButton from "./AdvertiseButton";
import Link from "next/link";
import { headers } from "next/headers";
import { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ name: string; uuid: string }> }) {
  const { name, uuid } = await params;
  const challenge = challenges[name as keyof typeof challenges];
  if (!challenge) {
    return { title: "Challenge not found" };
  }

  const metadata: Metadata = {
    title: `ARENA - Challenge (${name}) ${uuid}`,
    description: challenge.description,
  };
  return metadata;
}

export default async function UUIDPage({ 
  params,
  searchParams
}: { 
  params: Promise<{ name: string; uuid: string }>,
  searchParams: Promise<{ invites?: string[] }>
}) {
  const { name, uuid } = await params;
  const { invites = [] } = await searchParams;
  
  // Get the origin from headers
  const headersList = await headers();
  const host = headersList.get("host") || "";
  const protocol = headersList.get("x-forwarded-proto") || "http";
  const origin = `${protocol}://${host}`;

  const challenge = challenges[name as keyof typeof challenges];
  if (!challenge) {
    return <div>Challenge {name} not found</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white">
      <Header />

      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="flex flex-col gap-6 mb-10">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold text-zinc-900" style={{ fontFamily: 'var(--font-jost), sans-serif' }}>
              {challenge.name}
            </h1>
            <p className="text-base text-zinc-900">
              {challenge.description}
            </p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto border border-zinc-900 p-8 mb-6">
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 mb-2">Session ID</h2>
              <div className="text-sm text-zinc-600 font-mono">
                <CopyableInvite invite={uuid} copyText={`${origin}/challenges/${name}/${uuid}`} className="text-sm text-zinc-600 font-mono flex items-center gap-2 group cursor-pointer hover:text-zinc-900 transition-colors" />
              </div>
              {invites && invites.length > 0 && (
                <div className="mt-4">
                  <h2 className="text-lg font-semibold text-zinc-900 mb-2">Invites <Link href="/docs" className="text-sm text-zinc-600">(how to join?)</Link></h2>
                  <div className="list-none space-y-1">
                    {invites.map((invite, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <CopyableInvite invite={invite} className="text-sm text-zinc-600 font-mono flex items-center gap-2 group cursor-pointer hover:text-zinc-900 transition-colors" />
                        <AdvertiseButton inviteId={invite} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
            </div>
          </div>
        </div>
        
        <div className="mb-8">
          <ChallengePrompt prompt={challenge.prompt} />
        </div>

        <div className="max-w-4xl mx-auto border border-zinc-900 p-8">
          <ConversationsList uuid={uuid} />
        </div>
        
      </section>
    </div>
  );
}

