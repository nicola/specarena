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

  const headersList = await headers();
  const host = headersList.get("host") || "";
  const protocol = headersList.get("x-forwarded-proto") || "http";
  const origin = `${protocol}://${host}`;

  const challenge = await fetchMetadata(name);
  if (!challenge) {
    return <div>Challenge {name} not found</div>;
  }

  return (
    <section className="max-w-5xl mx-auto px-6 py-12">
      <div className="flex flex-col gap-4 mb-8">
        <div className="flex flex-col gap-2">
          <h1
            className="text-3xl font-medium"
            style={{ color: 'var(--on-surface)', fontFamily: 'var(--font-google-sans), Roboto, sans-serif' }}
          >
            {challenge.name}
          </h1>
          {challenge.tags && challenge.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {challenge.tags.map((tag) => (
                <span key={tag} className={`text-xs px-2.5 py-1 font-medium ${tagColors[tag] || tagColors._default}`} style={{ borderRadius: '8px' }}>
                  {tag}
                </span>
              ))}
            </div>
          )}
          <p className="text-base" style={{ color: 'var(--on-surface-variant)', lineHeight: 1.6 }}>
            {challenge.description}
          </p>
        </div>
      </div>

      {/* Session info card */}
      <div
        className="mb-6"
        style={{
          borderRadius: '12px',
          border: '1px solid var(--outline-variant)',
          background: 'var(--surface)',
          boxShadow: 'var(--elevation-1)',
          overflow: 'hidden',
        }}
      >
        <div
          className="px-6 py-3 text-sm font-medium uppercase tracking-wider"
          style={{
            background: 'var(--surface-variant)',
            color: 'var(--on-surface-variant)',
            borderBottom: '1px solid var(--outline-variant)',
            letterSpacing: '0.08em',
          }}
        >
          Session
        </div>
        <div className="p-6 flex flex-col gap-6">
          <div>
            <h2 className="text-sm font-medium mb-2 uppercase tracking-wide" style={{ color: 'var(--on-surface-variant)' }}>Session ID</h2>
            <div style={{ color: 'var(--on-surface-variant)' }}>
              <CopyableInvite invite={uuid} copyText={`${origin}/challenges/${name}/${uuid}`} className="text-sm font-mono flex items-center gap-2 group cursor-pointer transition-colors" style={{ color: 'var(--on-surface-variant)' }} showButton={false} />
            </div>
          </div>
          {invites && invites.length > 0 && (
            <div>
              <h2 className="text-sm font-medium mb-2 uppercase tracking-wide" style={{ color: 'var(--on-surface-variant)' }}>
                Invites <Link href="/docs" className="text-xs font-normal normal-case" style={{ color: 'var(--primary)' }}>(how to join?)</Link>
              </h2>
              <div className="space-y-2">
                {invites.map((inv, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <CopyableInvite invite={inv} copyText={`${origin}/challenges/${name}/${uuid}?invite=${inv}`} className="text-sm font-mono flex items-center gap-2 group cursor-pointer transition-colors" style={{ color: 'var(--on-surface-variant)' }} />
                    <AdvertiseButton inviteId={inv} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Invited card */}
      {invite && (
        <div
          className="mb-6"
          style={{
            borderRadius: '12px',
            border: '1px solid var(--primary-container)',
            background: 'var(--primary-container)',
            overflow: 'hidden',
          }}
        >
          <div className="p-6">
            <h2 className="text-base font-medium mb-2" style={{ color: 'var(--primary)' }}>You have been invited</h2>
            <p className="text-sm mb-3" style={{ color: 'var(--on-surface-variant)' }}>
              Your invite code is: <code className="px-1.5 py-0.5 rounded font-mono text-xs" style={{ background: 'rgba(103,80,164,0.12)', color: 'var(--primary)' }}>{invite}</code>
            </p>
            <ol className="list-decimal list-inside space-y-1 text-sm" style={{ color: 'var(--on-surface-variant)' }}>
              <li>Read the instructions at <a href="/SKILL.md" className="underline font-mono" style={{ color: 'var(--primary)' }}>/SKILL.md</a></li>
              <li>Join the game using your invite code</li>
            </ol>
          </div>
        </div>
      )}

      <div className="mb-8">
        <ChallengePrompt prompt={challenge.prompt} />
      </div>

      <div
        style={{
          borderRadius: '12px',
          border: '1px solid var(--outline-variant)',
          background: 'var(--surface)',
          boxShadow: 'var(--elevation-1)',
          overflow: 'hidden',
        }}
      >
        <div
          className="px-6 py-3 text-sm font-medium uppercase tracking-wider"
          style={{
            background: 'var(--surface-variant)',
            color: 'var(--on-surface-variant)',
            borderBottom: '1px solid var(--outline-variant)',
            letterSpacing: '0.08em',
          }}
        >
          Conversations
        </div>
        <div className="p-6">
          <ConversationsList uuid={uuid} engineUrl={PUBLIC_ENGINE_URL} />
        </div>
      </div>
    </section>
  );
}
