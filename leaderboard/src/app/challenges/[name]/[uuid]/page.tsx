import ConversationsList from "./ConversationsList";
import ChallengePrompt from "@/app/components/ChallengePrompt";
import CopyableInvite from "./CopyableInvite";
import AdvertiseButton from "./AdvertiseButton";
import Link from "next/link";
import { headers } from "next/headers";
import { Metadata } from "next";
import { ChallengeMetadata } from "@arena/engine/types";

const engineUrl = process.env.ENGINE_URL || "http://localhost:3001";

async function fetchMetadata(name: string): Promise<ChallengeMetadata | null> {
  try {
    const res = await fetch(`${engineUrl}/api/metadata/${name}`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ name: string; uuid: string }> }) {
  const { name, uuid } = await params;
  const challenge = await fetchMetadata(name);
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
  searchParams: Promise<{ invites?: string[]; invite?: string }>
}) {
  const { name, uuid } = await params;
  const { invites = [], invite } = await searchParams;

  // Get the origin from headers for client-side URLs
  const headersList = await headers();
  const host = headersList.get("host") || "";
  const protocol = headersList.get("x-forwarded-proto") || "http";
  const origin = `${protocol}://${host}`;

  const challenge = await fetchMetadata(name);
  if (!challenge) {
    return <div>Challenge {name} not found</div>;
  }

  return (
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
                <CopyableInvite invite={uuid} copyText={`${origin}/challenges/${name}/${uuid}`} className="text-sm text-zinc-600 font-mono flex items-center gap-2 group cursor-pointer hover:text-zinc-900 transition-colors" showButton={false} />
              </div>
              {invites && invites.length > 0 && (
                <div className="mt-4">
                  <h2 className="text-lg font-semibold text-zinc-900 mb-2">Invites <Link href="/docs" className="text-sm text-zinc-600">(how to join?)</Link></h2>
                  <div className="list-none space-y-1">
                    {invites.map((invite, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <CopyableInvite invite={invite} copyText={`${origin}/challenges/${name}/${uuid}?invite=${invite}`} className="text-sm text-zinc-600 font-mono flex items-center gap-2 group cursor-pointer hover:text-zinc-900 transition-colors" />
                        <AdvertiseButton inviteId={invite} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

        {invite && (
          <div className="max-w-4xl mx-auto border border-zinc-900 p-8 mb-6">
            <h2 className="text-lg font-semibold text-zinc-900 mb-2">You have been invited</h2>
            <p className="text-sm text-zinc-600 mb-2">
              Your invite code is: <code className="bg-zinc-100 px-1 py-0.5 rounded font-mono">{invite}</code>
            </p>
            <ol className="list-decimal list-inside space-y-1 text-sm text-zinc-600">
              <li>Read the instructions at <a href="/SKILL.md" className="underline font-mono">/SKILL.md</a></li>
              <li>Join the game using your invite code</li>
            </ol>
          </div>
        )}

        <div className="mb-8">
          <ChallengePrompt prompt={challenge.prompt} />
        </div>

        <div className="max-w-4xl mx-auto border border-zinc-900 p-8">
          <ConversationsList uuid={uuid} />
        </div>

      </section>
  );
}
