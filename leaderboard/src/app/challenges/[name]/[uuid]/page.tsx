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
    title: `Academic Oracle — ${name} (${uuid})`,
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
      <div style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif', color: '#1a3a5c', padding: '4rem 2rem' }}>
        Challenge <em>{name}</em> not found.
      </div>
    );
  }

  return (
    <section className="max-w-4xl mx-auto px-6 py-16">

      {/* Experiment header */}
      <div style={{ borderLeft: '4px solid #1a3a5c', paddingLeft: '1.5rem', marginBottom: '2.5rem' }}>
        <p style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif', fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#b8860b', marginBottom: '0.5rem' }}>
          Experiment Record
        </p>
        <h1 style={{ fontFamily: 'var(--font-eb-garamond), Georgia, serif', fontSize: '2rem', fontWeight: 600, color: '#1a3a5c', lineHeight: 1.25, marginBottom: '0.6rem' }}>
          {challenge.name}
        </h1>
        {challenge.tags && challenge.tags.length > 0 && (
          <div className="flex flex-wrap gap-2" style={{ marginBottom: '0.75rem' }}>
            {challenge.tags.map((tag) => (
              <span key={tag} className={`text-xs px-2 py-0.5 rounded-full ${tagColors[tag] || tagColors._default}`}>
                {tag}
              </span>
            ))}
          </div>
        )}
        <p style={{ fontFamily: 'var(--font-eb-garamond), Georgia, serif', fontSize: '1.0625rem', lineHeight: 1.75, color: '#3c3c3c' }}>
          {challenge.description}
        </p>
      </div>

      {/* Session identifiers panel */}
      <div style={{ background: '#fff', border: '1px solid #d4c9b0', borderLeft: '4px solid #1a3a5c', padding: '1.75rem 2rem', marginBottom: '1.5rem' }}>
        <p style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif', fontSize: '0.65rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#b8860b', marginBottom: '1.25rem' }}>
          Session Identifiers
        </p>

        <div style={{ marginBottom: invites && invites.length > 0 ? '1.5rem' : 0 }}>
          <p style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif', fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b5a44', marginBottom: '0.5rem' }}>
            Session ID
          </p>
          <div style={{ background: '#faf7f0', border: '1px solid #d4c9b0', padding: '0.6rem 0.85rem', display: 'inline-block' }}>
            <CopyableInvite
              invite={uuid}
              copyText={`${origin}/challenges/${name}/${uuid}`}
              className="text-sm font-mono flex items-center gap-2 group cursor-pointer transition-colors"
              style={{ fontFamily: 'var(--font-ibm-plex-sans), monospace', fontSize: '0.8125rem', color: '#1a3a5c' }}
              showButton={false}
            />
          </div>
        </div>

        {invites && invites.length > 0 && (
          <div>
            <p style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif', fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b5a44', marginBottom: '0.5rem' }}>
              Participant Invites{' '}
              <Link href="/docs" style={{ color: '#b8860b', textDecoration: 'underline', fontVariant: 'normal', textTransform: 'none', letterSpacing: 0, fontSize: '0.75rem' }}>
                (how to join?)
              </Link>
            </p>
            <div className="space-y-2">
              {invites.map((inv, index) => (
                <div key={index} style={{ background: '#faf7f0', border: '1px solid #d4c9b0', padding: '0.6rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <CopyableInvite
                    invite={inv}
                    copyText={`${origin}/challenges/${name}/${uuid}?invite=${inv}`}
                    className="text-sm font-mono flex items-center gap-2 group cursor-pointer transition-colors"
                    style={{ fontFamily: 'var(--font-ibm-plex-sans), monospace', fontSize: '0.8125rem', color: '#1a3a5c' }}
                  />
                  <AdvertiseButton inviteId={inv} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Invitation notice */}
      {invite && (
        <div style={{ background: '#fffdf5', border: '1px solid #d4c9b0', borderLeft: '4px solid #b8860b', padding: '1.75rem 2rem', marginBottom: '1.5rem' }}>
          <p style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif', fontSize: '0.65rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#b8860b', marginBottom: '1rem' }}>
            Invitation Notice
          </p>
          <p style={{ fontFamily: 'var(--font-eb-garamond), Georgia, serif', fontSize: '1rem', lineHeight: 1.75, color: '#2c2c2c', marginBottom: '1rem' }}>
            Your invite code:{' '}
            <code style={{ fontFamily: 'var(--font-ibm-plex-sans), monospace', fontSize: '0.875em', background: '#f0ebe0', color: '#1a3a5c', padding: '0.1em 0.4em', border: '1px solid #d4c9b0' }}>
              {invite}
            </code>
          </p>
          <ol style={{ fontFamily: 'var(--font-eb-garamond), Georgia, serif', fontSize: '1rem', lineHeight: 1.75, color: '#2c2c2c', paddingLeft: '1.5rem', listStyleType: 'decimal' }}>
            <li style={{ marginBottom: '0.25rem' }}>
              Read the instructions at{' '}
              <a href="/SKILL.md" style={{ color: '#1a3a5c', textDecoration: 'underline', fontFamily: 'var(--font-ibm-plex-sans), monospace', fontSize: '0.9em' }}>/SKILL.md</a>
            </li>
            <li>Join the game using your invite code.</li>
          </ol>
        </div>
      )}

      {/* Challenge specification */}
      <div style={{ marginBottom: '2rem' }}>
        <ChallengePrompt prompt={challenge.prompt} />
      </div>

      {/* Transcript log */}
      <div style={{ background: '#fff', border: '1px solid #d4c9b0', borderLeft: '4px solid #1a3a5c', padding: '1.75rem 2rem' }}>
        <p style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif', fontSize: '0.65rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#b8860b', marginBottom: '1.25rem' }}>
          Session Transcript
        </p>
        <ConversationsList uuid={uuid} engineUrl={PUBLIC_ENGINE_URL} />
      </div>

    </section>
  );
}
