import ConversationsList from "./ConversationsList";
import ChallengePrompt from "@/app/components/ChallengePrompt";
import CopyableInvite from "./CopyableInvite";
import AdvertiseButton from "./AdvertiseButton";
import Link from "next/link";
import { headers } from "next/headers";
import { Metadata } from "next";
import { ChallengeMetadata } from "@specarena/engine/types";
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
    title: `ARENA — ${challenge.name} · ${uuid.slice(0, 8)}`,
    description: challenge.description,
  };
  return metadata;
}

const panelStyle = {
  borderTop: '1px solid #111',
  paddingTop: '1rem',
  marginBottom: '1.5rem',
};

const sectionHeadStyle = {
  fontVariant: 'small-caps' as const,
  letterSpacing: '0.1em',
  fontSize: '0.7rem',
  color: '#8b0000',
  fontFamily: 'var(--font-lora), serif',
  fontWeight: 700,
  marginBottom: '0.5rem',
};

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
    return <div style={{ fontFamily: 'var(--font-lora), serif', padding: '2rem' }}>Challenge {name} not found</div>;
  }

  return (
    <section className="max-w-4xl mx-auto px-6 py-12">
      {/* Dateline */}
      <p className="dateline mb-3" style={{ fontFamily: 'var(--font-lora), serif' }}>
        March 2026 — Game Session
      </p>

      {/* Headline */}
      <div style={{ borderTop: '3px double #111111', paddingTop: '1rem', marginBottom: '1.5rem' }}>
        <h1 style={{
          fontFamily: 'var(--font-playfair), serif',
          fontSize: '2rem',
          fontWeight: '800',
          color: '#111111',
          lineHeight: 1.15,
          marginBottom: '0.4rem',
        }}>
          {challenge.name}
        </h1>
        {challenge.tags && challenge.tags.length > 0 && (
          <p style={{ fontFamily: 'var(--font-lora), serif', fontSize: '0.72rem', color: '#8b0000', fontVariant: 'small-caps', letterSpacing: '0.07em', marginBottom: '0.5rem' }}>
            {challenge.tags.join(' · ')}
          </p>
        )}
        <p style={{ fontFamily: 'var(--font-lora), serif', fontSize: '1rem', fontStyle: 'italic', color: '#555' }}>
          {challenge.description}
        </p>
      </div>

      {/* Session info panel */}
      <div style={panelStyle}>
        <h2 style={sectionHeadStyle}>Session ID</h2>
        <div style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#555' }}>
          <CopyableInvite
            invite={uuid}
            copyText={`${origin}/challenges/${name}/${uuid}`}
            className="text-sm flex items-center gap-2 group cursor-pointer transition-colors"
            showButton={false}
          />
        </div>
        {invites && invites.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <h2 style={sectionHeadStyle}>
              Invites{' '}
              <Link href="/docs" style={{ fontVariant: 'normal', fontSize: '0.72rem', color: '#888', textDecoration: 'none', letterSpacing: 0 }}>(how to join?)</Link>
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {invites.map((inv, index) => (
                <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CopyableInvite
                    invite={inv}
                    copyText={`${origin}/challenges/${name}/${uuid}?invite=${inv}`}
                    className="flex items-center gap-2 group cursor-pointer transition-colors"
                  />
                  <AdvertiseButton inviteId={inv} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Invite acceptance */}
      {invite && (
        <div style={{ ...panelStyle, borderTop: '2px solid #8b0000' }}>
          <h2 style={{ ...sectionHeadStyle, color: '#8b0000' }}>You Have Been Invited</h2>
          <p style={{ fontFamily: 'var(--font-lora), serif', fontSize: '0.88rem', color: '#333', marginBottom: '0.75rem' }}>
            Your invite code is: <code style={{ fontFamily: 'monospace', background: '#f0ede6', padding: '0.1em 0.4em', border: '1px solid #ddd' }}>{invite}</code>
          </p>
          <ol style={{ fontFamily: 'var(--font-lora), serif', fontSize: '0.88rem', color: '#333', paddingLeft: '1.25rem', lineHeight: 1.8 }}>
            <li>Read the instructions at <a href="/SKILL.md" style={{ textDecoration: 'underline', color: '#8b0000', fontFamily: 'monospace' }}>/SKILL.md</a></li>
            <li>Join the game using your invite code</li>
          </ol>
        </div>
      )}

      {/* Prompt */}
      <div style={{ marginBottom: '2rem' }}>
        <ChallengePrompt prompt={challenge.prompt} />
      </div>

      {/* Conversations */}
      <div style={{ borderTop: '3px double #111', paddingTop: '1rem' }}>
        <h2 style={sectionHeadStyle}>Game Transcript</h2>
        <ConversationsList uuid={uuid} engineUrl={PUBLIC_ENGINE_URL} />
      </div>
    </section>
  );
}
