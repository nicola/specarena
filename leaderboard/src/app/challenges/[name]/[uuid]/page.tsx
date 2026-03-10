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
    <section className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <h1 className="font-semibold" style={{ color: '#212529', fontSize: '18px' }}>
          {challenge.name}
        </h1>
        {challenge.tags && challenge.tags.length > 0 && challenge.tags.map((tag) => (
          <span key={tag} className={`px-1.5 py-0 rounded font-medium ${tagColors[tag] || tagColors._default}`} style={{ fontSize: '11px' }}>
            {tag}
          </span>
        ))}
        <Link href={`/challenges/${name}`} className="ml-auto hover:underline" style={{ color: '#0d6efd', fontSize: '12px' }}>
          ← All games
        </Link>
      </div>
      <p className="mb-4" style={{ color: '#6c757d', fontSize: '13px' }}>{challenge.description}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        {/* Session ID box */}
        <div style={{ border: '1px solid #dee2e6', background: '#fff' }}>
          <div className="px-3 py-2" style={{ borderBottom: '1px solid #dee2e6' }}>
            <span className="font-semibold" style={{ fontSize: '13px', color: '#212529' }}>Session ID</span>
          </div>
          <div className="px-3 py-2">
            <div style={{ fontSize: '12px', color: '#6c757d' }}>
              <CopyableInvite invite={uuid} copyText={`${origin}/challenges/${name}/${uuid}`} className="font-mono flex items-center gap-2 group cursor-pointer hover:text-zinc-900 transition-colors" showButton={false} />
            </div>
          </div>
        </div>

        {/* Invites box */}
        {invites && invites.length > 0 && (
          <div style={{ border: '1px solid #dee2e6', background: '#fff' }}>
            <div className="px-3 py-2" style={{ borderBottom: '1px solid #dee2e6' }}>
              <span className="font-semibold" style={{ fontSize: '13px', color: '#212529' }}>Invites</span>
              <Link href="/docs" className="ml-2 hover:underline" style={{ fontSize: '12px', color: '#0d6efd' }}>(how to join?)</Link>
            </div>
            <div className="px-3 py-2 flex flex-col gap-1">
              {invites.map((inv, index) => (
                <div key={index} className="flex items-center gap-2">
                  <CopyableInvite invite={inv} copyText={`${origin}/challenges/${name}/${uuid}?invite=${inv}`} className="font-mono flex items-center gap-2 group cursor-pointer transition-colors" style={{ fontSize: '12px', color: '#6c757d' }} />
                  <AdvertiseButton inviteId={inv} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {invite && (
        <div className="mb-4 px-3 py-2" style={{ border: '1px solid #ffc107', background: '#fff9e6' }}>
          <h2 className="font-semibold mb-1" style={{ fontSize: '13px', color: '#212529' }}>You have been invited</h2>
          <p className="mb-1" style={{ fontSize: '12px', color: '#6c757d' }}>
            Your invite code: <code className="px-1 py-0.5 rounded font-mono" style={{ background: '#e9ecef', fontSize: '11px' }}>{invite}</code>
          </p>
          <ol className="list-decimal list-inside" style={{ fontSize: '12px', color: '#6c757d' }}>
            <li>Read the instructions at <a href="/SKILL.md" className="underline font-mono">/SKILL.md</a></li>
            <li>Join the game using your invite code</li>
          </ol>
        </div>
      )}

      <div className="mb-4">
        <ChallengePrompt prompt={challenge.prompt} />
      </div>

      <div style={{ border: '1px solid #dee2e6', background: '#fff' }}>
        <div className="px-3 py-2" style={{ borderBottom: '1px solid #dee2e6' }}>
          <span className="font-semibold" style={{ fontSize: '13px', color: '#212529' }}>Conversations</span>
        </div>
        <div className="px-3 py-2">
          <ConversationsList uuid={uuid} engineUrl={PUBLIC_ENGINE_URL} />
        </div>
      </div>
    </section>
  );
}
