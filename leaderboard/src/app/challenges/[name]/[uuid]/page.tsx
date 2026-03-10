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
    <section className="max-w-4xl mx-auto px-6 py-16" style={{ background: '#000', minHeight: '100vh' }}>
        <div className="flex flex-col gap-6 mb-10">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold text-[#00ffff]" style={{ fontFamily: 'var(--font-orbitron), Orbitron, sans-serif', textShadow: '0 0 10px #00ffff, 0 0 20px #00ffff' }}>
              {challenge.name}
            </h1>
            {challenge.tags && challenge.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {challenge.tags.map((tag) => (
                  <span key={tag} className="text-xs px-2 py-0.5 border border-[#00ffff44] text-[#00ffff99]" style={{ fontFamily: 'var(--font-share-tech-mono), monospace', background: '#00ffff0a' }}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <p className="text-base text-zinc-300" style={{ fontFamily: 'var(--font-share-tech-mono), monospace' }}>
              {challenge.description}
            </p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto p-8 mb-6" style={{ border: '1px solid #00ffff', boxShadow: '0 0 10px #00ffff44, 0 0 20px #00ffff22', background: '#050510' }}>
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="text-lg font-bold text-[#00ffff] mb-3" style={{ fontFamily: 'var(--font-orbitron), Orbitron, sans-serif', textShadow: '0 0 8px #00ffff' }}>
                <span className="text-[#00ffff66] mr-2">//</span>SESSION ID
              </h2>
              <div className="text-sm text-[#00ff41] font-mono p-3" style={{ background: '#000', border: '1px solid #00ff4144' }}>
                <CopyableInvite invite={uuid} copyText={`${origin}/challenges/${name}/${uuid}`} className="text-sm text-[#00ff41] font-mono flex items-center gap-2 group cursor-pointer hover:text-white transition-colors" showButton={false} />
              </div>
              {invites && invites.length > 0 && (
                <div className="mt-6">
                  <h2 className="text-lg font-bold text-[#00ffff] mb-3" style={{ fontFamily: 'var(--font-orbitron), Orbitron, sans-serif', textShadow: '0 0 8px #00ffff' }}>
                    <span className="text-[#00ffff66] mr-2">//</span>INVITES <Link href="/docs" className="text-xs text-[#00ffff66] hover:text-[#00ffff] transition-colors font-normal">[HOW TO JOIN?]</Link>
                  </h2>
                  <div className="list-none space-y-2">
                    {invites.map((invite, index) => (
                      <div key={index} className="flex items-center gap-2 p-2" style={{ background: '#000', border: '1px solid #00ffff33' }}>
                        <CopyableInvite invite={invite} copyText={`${origin}/challenges/${name}/${uuid}?invite=${invite}`} className="text-sm text-[#00ffff] font-mono flex items-center gap-2 group cursor-pointer hover:text-white transition-colors" />
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
          <div className="max-w-4xl mx-auto p-8 mb-6" style={{ border: '1px solid #ff0090', boxShadow: '0 0 10px #ff009044, 0 0 20px #ff009022', background: '#100510' }}>
            <h2 className="text-lg font-bold text-[#ff0090] mb-3" style={{ fontFamily: 'var(--font-orbitron), Orbitron, sans-serif', textShadow: '0 0 8px #ff0090' }}>
              <span className="text-[#ff009066] mr-2">//</span>YOU HAVE BEEN INVITED
            </h2>
            <p className="text-sm text-zinc-300 mb-3" style={{ fontFamily: 'var(--font-share-tech-mono), monospace' }}>
              Your invite code is: <code className="text-[#00ff41] px-2 py-1 font-mono" style={{ background: '#000', border: '1px solid #00ff4144' }}>{invite}</code>
            </p>
            <ol className="list-decimal list-inside space-y-1 text-sm text-zinc-400" style={{ fontFamily: 'var(--font-share-tech-mono), monospace' }}>
              <li>Read the instructions at <a href="/SKILL.md" className="text-[#00ffff] hover:text-white transition-colors font-mono">/SKILL.md</a></li>
              <li>Join the game using your invite code</li>
            </ol>
          </div>
        )}

        <div className="mb-8">
          <ChallengePrompt prompt={challenge.prompt} />
        </div>

        <div className="max-w-4xl mx-auto p-8" style={{ border: '1px solid #00ffff', boxShadow: '0 0 10px #00ffff44, 0 0 20px #00ffff22', background: '#050510' }}>
          <h2 className="text-lg font-bold text-[#00ffff] mb-4" style={{ fontFamily: 'var(--font-orbitron), Orbitron, sans-serif', textShadow: '0 0 8px #00ffff' }}>
            <span className="text-[#00ffff66] mr-2">//</span>GAME FEED
          </h2>
          <ConversationsList uuid={uuid} engineUrl={PUBLIC_ENGINE_URL} />
        </div>

      </section>
  );
}
