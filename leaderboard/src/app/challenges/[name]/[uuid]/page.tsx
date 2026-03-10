import ConversationsList from "./ConversationsList";
import ChallengePrompt from "@/app/components/ChallengePrompt";
import CopyableInvite from "./CopyableInvite";
import AdvertiseButton from "./AdvertiseButton";
import Link from "next/link";
import { headers } from "next/headers";
import { Metadata } from "next";
import { ChallengeMetadata } from "@arena/engine/types";
import { ENGINE_URL, PUBLIC_ENGINE_URL } from "@/lib/config";
import { tagColors } from "@/lib/tagColors";

async function fetchMetadata(name: string): Promise<ChallengeMetadata | null> {
  try {
    const res = await fetch(`${ENGINE_URL}/api/metadata/${name}`, { cache: "no-store" });
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
    <section className="max-w-4xl mx-auto px-8 py-20">
        <div className="flex flex-col gap-4 mb-12">
          <div className="flex flex-col gap-2">
            <h1 className="text-xl font-medium" style={{ color: '#1a1a1a', fontWeight: 500 }}>
              {challenge.name}
            </h1>
            {challenge.tags && challenge.tags.length > 0 && (
              <div className="flex flex-wrap gap-4">
                {challenge.tags.map((tag) => (
                  <span key={tag} className="text-xs flex items-center gap-1" style={{ color: '#aaaaaa' }}>
                    <span style={{ color: '#aaaaaa', fontSize: '8px' }}>●</span>
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <p className="text-sm leading-relaxed" style={{ color: '#aaaaaa' }}>
              {challenge.description}
            </p>
          </div>
        </div>

        <div className="mb-6 px-8 py-8" style={{ border: '1px solid #eeeeee' }}>
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="text-xs font-medium uppercase tracking-widest mb-3" style={{ color: '#aaaaaa', letterSpacing: '0.2em' }}>Session ID</h2>
              <div className="text-xs font-mono" style={{ color: '#aaaaaa' }}>
                <CopyableInvite invite={uuid} copyText={`${origin}/challenges/${name}/${uuid}`} className="text-xs font-mono flex items-center gap-2 group cursor-pointer transition-colors" showButton={false} />
              </div>
              {invites && invites.length > 0 && (
                <div className="mt-6">
                  <h2 className="text-xs font-medium uppercase tracking-widest mb-3" style={{ color: '#aaaaaa', letterSpacing: '0.2em' }}>Invites <Link href="/docs" className="text-xs ml-2" style={{ color: '#aaaaaa' }}>(how to join?)</Link></h2>
                  <div className="list-none space-y-2">
                    {invites.map((invite, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <CopyableInvite invite={invite} copyText={`${origin}/challenges/${name}/${uuid}?invite=${invite}`} className="text-xs font-mono flex items-center gap-2 group cursor-pointer transition-colors" />
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
          <div className="mb-6 px-8 py-8" style={{ border: '1px solid #eeeeee' }}>
            <h2 className="text-xs font-medium uppercase tracking-widest mb-3" style={{ color: '#aaaaaa', letterSpacing: '0.2em' }}>You have been invited</h2>
            <p className="text-xs mb-3" style={{ color: '#aaaaaa' }}>
              Your invite code is: <code className="px-1 py-0.5 font-mono" style={{ background: '#f5f5f5' }}>{invite}</code>
            </p>
            <ol className="list-decimal list-inside space-y-1 text-xs" style={{ color: '#aaaaaa' }}>
              <li>Read the instructions at <a href="/SKILL.md" className="underline font-mono">/SKILL.md</a></li>
              <li>Join the game using your invite code</li>
            </ol>
          </div>
        )}

        <div className="mb-8">
          <ChallengePrompt prompt={challenge.prompt} />
        </div>

        <div className="px-8 py-8" style={{ border: '1px solid #eeeeee' }}>
          <ConversationsList uuid={uuid} engineUrl={PUBLIC_ENGINE_URL} />
        </div>

      </section>
  );
}
