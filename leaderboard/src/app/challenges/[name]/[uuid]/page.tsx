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
    return (
      <div style={{ minHeight: '100vh', background: '#1a0533', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#ff006e', fontFamily: 'Orbitron, sans-serif' }}>Challenge {name} not found</p>
      </div>
    );
  }

  const cardStyle = {
    border: '1px solid #7b2fff',
    boxShadow: '0 0 15px rgba(123,47,255,0.3)',
    background: 'rgba(26,5,51,0.6)',
  };

  const labelStyle = {
    fontSize: '1.125rem',
    fontWeight: 600,
    color: '#00b4d8',
    marginBottom: '8px',
    fontFamily: 'Orbitron, sans-serif',
  };

  return (
    <section className="max-w-4xl mx-auto px-6 py-16">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '40px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h1 style={{
              fontFamily: 'Orbitron, sans-serif',
              fontSize: '2rem',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #ff006e, #8338ec, #3a86ff)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              {challenge.name}
            </h1>
            {challenge.tags && challenge.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {challenge.tags.map((tag) => (
                  <span key={tag} className={`text-xs px-2 py-0.5 rounded-full ${tagColors[tag] || tagColors._default}`}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <p style={{ fontSize: '1rem', color: '#c4b5d4' }}>
              {challenge.description}
            </p>
          </div>
        </div>

        <div style={{ ...cardStyle, padding: '32px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <h2 style={labelStyle}>Session ID</h2>
              <div style={{ fontSize: '0.875rem', color: '#c4b5d4', fontFamily: 'monospace' }}>
                <CopyableInvite invite={uuid} copyText={`${origin}/challenges/${name}/${uuid}`} className="text-sm font-mono flex items-center gap-2 group cursor-pointer transition-colors" showButton={false} />
              </div>
              {invites && invites.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <h2 style={labelStyle}>
                    Invites <Link href="/docs" style={{ fontSize: '0.875rem', fontWeight: 400, color: '#9d7fba', textDecoration: 'none' }}>(how to join?)</Link>
                  </h2>
                  <div style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {invites.map((inv, index) => (
                      <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CopyableInvite invite={inv} copyText={`${origin}/challenges/${name}/${uuid}?invite=${inv}`} className="text-sm font-mono flex items-center gap-2 group cursor-pointer transition-colors" />
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
          <div style={{ ...cardStyle, padding: '32px', marginBottom: '24px' }}>
            <h2 style={labelStyle}>You have been invited</h2>
            <p style={{ fontSize: '0.875rem', color: '#c4b5d4', marginBottom: '8px' }}>
              Your invite code is: <code style={{ background: 'rgba(123,47,255,0.2)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace', color: '#ff006e', border: '1px solid rgba(255,0,110,0.3)' }}>{invite}</code>
            </p>
            <ol style={{ listStyleType: 'decimal', listStylePosition: 'inside', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.875rem', color: '#c4b5d4' }}>
              <li>Read the instructions at <a href="/SKILL.md" style={{ color: '#00b4d8', textDecoration: 'underline', fontFamily: 'monospace' }}>/SKILL.md</a></li>
              <li>Join the game using your invite code</li>
            </ol>
          </div>
        )}

        <div style={{ marginBottom: '32px' }}>
          <ChallengePrompt prompt={challenge.prompt} />
        </div>

        <div style={{ ...cardStyle, padding: '32px' }}>
          <ConversationsList uuid={uuid} engineUrl={PUBLIC_ENGINE_URL} />
        </div>

      </section>
  );
}
