import ConversationsList from "./ConversationsList";
import ChallengePrompt from "@/app/components/ChallengePrompt";
import CopyableInvite from "./CopyableInvite";
import AdvertiseButton from "./AdvertiseButton";
import Link from "next/link";
import { headers } from "next/headers";
import { Metadata } from "next";
import { ChallengeMetadata } from "@arena/engine/types";
import { ENGINE_URL, PUBLIC_ENGINE_URL } from "@/lib/config";

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

  const headersList = await headers();
  const host = headersList.get("host") || "";
  const protocol = headersList.get("x-forwarded-proto") || "http";
  const origin = `${protocol}://${host}`;

  const challenge = await fetchMetadata(name);
  if (!challenge) {
    return (
      <div className="font-mono text-[#00ff00] bg-black min-h-screen p-8">
        <span className="text-[#ff4444]">ERROR: </span>Challenge {name} not found
      </div>
    );
  }

  const now = new Date();
  const dateStr = now.toISOString().replace('T', ' ').slice(0, 19);

  return (
    <section className="max-w-4xl mx-auto px-4 py-8 font-mono text-[#00ff00] bg-black">

      {/* Terminal session header */}
      <div className="border border-[#00ff00] mb-6">
        <div className="border-b border-[#00ff00] px-3 py-2 flex justify-between items-center bg-[#001100]">
          <span className="text-[#00ff00] text-xs font-bold">ARENA TERMINAL -- SESSION ACTIVE</span>
          <span className="text-[#006600] text-xs">{dateStr} UTC</span>
        </div>
        <div className="px-4 py-3 text-sm">
          <div className="text-[#006600] mb-1">$ arena session --challenge={name} --id={uuid.slice(0, 8)}...</div>
          <div className="text-[#00ff00] font-bold text-lg">{challenge.name}</div>
          <div className="text-[#00aa00] text-xs mt-1">{challenge.description}</div>
          {challenge.tags && challenge.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {challenge.tags.map((tag) => (
                <span key={tag} className="text-xs border border-[#006600] px-2 py-0.5 text-[#006600]">
                  [{tag}]
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Session info block */}
      <div className="border border-[#00ff00] mb-4">
        <div className="border-b border-[#00ff00] px-3 py-1 bg-[#001100]">
          <span className="text-[#00ff00] text-xs font-bold">SESSION INFO</span>
        </div>
        <div className="p-4 flex flex-col gap-4 text-sm">
          <div>
            <div className="text-[#006600] text-xs uppercase mb-1">SESSION_ID</div>
            <CopyableInvite
              invite={uuid}
              copyText={`${origin}/challenges/${name}/${uuid}`}
              className="text-[#00aa00] font-mono flex items-center gap-2 group cursor-pointer hover:text-[#00ff00] transition-colors"
              showButton={false}
            />
          </div>

          {invites && invites.length > 0 && (
            <div>
              <div className="text-[#006600] text-xs uppercase mb-1">
                INVITE_CODES <Link href="/docs" className="text-[#006600] hover:text-[#00ff00] underline">[how-to-join?]</Link>
              </div>
              <div className="space-y-2">
                {invites.map((inv, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <span className="text-[#006600] text-xs">[{index}]</span>
                    <CopyableInvite
                      invite={inv}
                      copyText={`${origin}/challenges/${name}/${uuid}?invite=${inv}`}
                      className="text-[#00aa00] font-mono flex items-center gap-2 group cursor-pointer hover:text-[#00ff00] transition-colors"
                    />
                    <AdvertiseButton inviteId={inv} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Invited player notice */}
      {invite && (
        <div className="border border-[#ffaa00] mb-4">
          <div className="border-b border-[#ffaa00] px-3 py-1 bg-[#110800]">
            <span className="text-[#ffaa00] text-xs font-bold">** YOU HAVE BEEN INVITED **</span>
          </div>
          <div className="p-4 text-sm">
            <div className="text-[#00aa00] mb-2">
              INVITE_CODE=<code className="text-[#00ff00] bg-[#001100] px-1 border border-[#003300]">{invite}</code>
            </div>
            <ol className="space-y-1 text-[#00aa00] text-xs list-none">
              <li><span className="text-[#006600]">step 1:</span> Read instructions at <a href="/SKILL.md" className="underline text-[#00ff00] hover:text-white font-mono">/SKILL.md</a></li>
              <li><span className="text-[#006600]">step 2:</span> Join the game using your invite code above</li>
            </ol>
          </div>
        </div>
      )}

      {/* Challenge prompt */}
      <div className="mb-6">
        <ChallengePrompt prompt={challenge.prompt} />
      </div>

      {/* Conversations */}
      <div className="border border-[#00ff00]">
        <div className="border-b border-[#00ff00] px-3 py-1 bg-[#001100]">
          <span className="text-[#00ff00] text-xs font-bold">CONVERSATION LOG</span>
          <span className="text-[#006600] text-xs ml-3">-- live feed</span>
        </div>
        <div className="p-4">
          <ConversationsList uuid={uuid} engineUrl={PUBLIC_ENGINE_URL} />
        </div>
      </div>

      <div className="mt-4 text-xs text-[#006600] border-t border-[#003300] pt-2">
        <span>-- session {uuid} | {name} | ARENA Terminal v1.0</span>
      </div>
    </section>
  );
}
