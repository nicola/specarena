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

const inkPanel = {
  background: '#faf6ef',
  border: '1px solid #d4c4a8',
  boxShadow: 'inset 0 1px 3px rgba(26,16,8,0.06)',
} as const;

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
    return <div style={{ color: '#1a1008', padding: '2rem' }}>Challenge {name} not found</div>;
  }

  return (
    <section className="max-w-4xl mx-auto px-6 py-16">
      <div className="flex flex-col gap-6 mb-10">
        <div className="flex flex-col gap-2">
          <div style={{ width: 40, height: 2, background: '#cc2200', opacity: 0.8, marginBottom: 4 }} />
          <h1
            className="text-3xl font-semibold"
            style={{ fontFamily: 'var(--font-noto-serif), serif', color: '#1a1008', letterSpacing: '0.03em' }}
          >
            {challenge.name}
          </h1>
          {challenge.tags && challenge.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {challenge.tags.map((tag) => (
                <span key={tag} className={`text-xs px-2 py-0.5 ${tagColors[tag] || tagColors._default}`}>
                  {tag}
                </span>
              ))}
            </div>
          )}
          <p className="text-base" style={{ color: '#5a4030', lineHeight: 1.7 }}>
            {challenge.description}
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-8 mb-6" style={inkPanel}>
        <div className="flex flex-col gap-6">
          <div>
            <h2
              className="text-lg font-semibold mb-2"
              style={{ fontFamily: 'var(--font-noto-serif)', color: '#1a1008' }}
            >
              Session ID
            </h2>
            <div className="text-sm font-mono" style={{ color: '#8b4513' }}>
              <CopyableInvite
                invite={uuid}
                copyText={`${origin}/challenges/${name}/${uuid}`}
                className="text-sm font-mono flex items-center gap-2 group cursor-pointer hover:text-zinc-900 transition-colors"
                showButton={false}
              />
            </div>
            {invites && invites.length > 0 && (
              <div className="mt-4">
                <h2
                  className="text-lg font-semibold mb-2"
                  style={{ fontFamily: 'var(--font-noto-serif)', color: '#1a1008' }}
                >
                  Invites{" "}
                  <Link href="/docs" style={{ fontSize: 14, color: '#8b4513', fontWeight: 400, textDecoration: 'underline' }}>
                    (how to join?)
                  </Link>
                </h2>
                <div className="list-none space-y-1">
                  {invites.map((inv, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <CopyableInvite
                        invite={inv}
                        copyText={`${origin}/challenges/${name}/${uuid}?invite=${inv}`}
                        className="text-sm font-mono flex items-center gap-2 group cursor-pointer hover:text-zinc-900 transition-colors"
                      />
                      <AdvertiseButton inviteId={inv} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {invite && (
        <div className="max-w-4xl mx-auto p-8 mb-6" style={inkPanel}>
          <h2 className="text-lg font-semibold mb-2" style={{ fontFamily: 'var(--font-noto-serif)', color: '#1a1008' }}>
            You have been invited
          </h2>
          <p className="text-sm mb-2" style={{ color: '#5a4030' }}>
            Your invite code is:{" "}
            <code
              style={{
                background: '#f0e8d8',
                padding: '1px 6px',
                fontFamily: 'var(--font-geist-mono)',
                color: '#1a1008',
                border: '1px solid #d4c4a8',
              }}
            >
              {invite}
            </code>
          </p>
          <ol className="list-decimal list-inside space-y-1 text-sm" style={{ color: '#5a4030' }}>
            <li>Read the instructions at <a href="/SKILL.md" style={{ textDecoration: 'underline', fontFamily: 'var(--font-geist-mono)', color: '#cc2200' }}>/SKILL.md</a></li>
            <li>Join the game using your invite code</li>
          </ol>
        </div>
      )}

      <div className="mb-8">
        <ChallengePrompt prompt={challenge.prompt} />
      </div>

      <div className="max-w-4xl mx-auto p-8" style={inkPanel}>
        <ConversationsList uuid={uuid} engineUrl={PUBLIC_ENGINE_URL} />
      </div>
    </section>
  );
}
