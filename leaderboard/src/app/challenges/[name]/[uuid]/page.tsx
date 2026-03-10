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
    return { title: "ARENA WIRE — Dispatch Not Found" };
  }
  const metadata: Metadata = {
    title: `ARENA WIRE — ${challenge.name} · ${uuid.slice(0, 8)}`,
    description: challenge.description,
  };
  return metadata;
}

const monoSection = {
  borderTop: '2px solid #111',
  borderBottom: '1px solid #ddd',
  padding: '0.4rem 0',
  marginBottom: '1rem',
  fontFamily: 'var(--font-mono)' as const,
  fontSize: '0.62rem' as const,
  fontWeight: 700 as const,
  letterSpacing: '0.15em' as const,
  textTransform: 'uppercase' as const,
  color: '#111' as const,
};

const monoLabel = {
  fontFamily: 'var(--font-mono)' as const,
  fontSize: '0.52rem' as const,
  letterSpacing: '0.1em' as const,
  fontWeight: 600 as const,
  textTransform: 'uppercase' as const,
  color: '#888' as const,
  display: 'block' as const,
  marginBottom: '0.2rem',
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
    return (
      <div style={{ fontFamily: 'var(--font-mono)', padding: '2rem', fontSize: '0.8rem', color: '#888', letterSpacing: '0.08em' }}>
        DISPATCH NOT FOUND — {name.toUpperCase()} — CHECK TRANSMISSION ID
      </div>
    );
  }

  const nowStr = new Date().toLocaleString('en-US', {
    month: 'long', day: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).toUpperCase();

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">

      {/* FOR IMMEDIATE RELEASE */}
      <div style={{
        borderTop: '4px solid #111',
        borderBottom: '1px solid #111',
        padding: '0.5rem 0',
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.65rem',
          fontWeight: 700,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: '#111',
        }}>
          FOR IMMEDIATE RELEASE
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.58rem',
          color: '#888',
          letterSpacing: '0.08em',
        }}>
          ARENA WIRE — {nowStr}
        </span>
      </div>

      {/* Wire code + dateline */}
      <div className="flex items-center gap-3 mb-3">
        <span style={{
          background: '#cc0000',
          color: '#fff',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.6rem',
          fontWeight: 600,
          letterSpacing: '0.1em',
          padding: '0.15em 0.5em',
          textTransform: 'uppercase',
        }}>
          GAME SESSION
        </span>
        {challenge.tags?.map(tag => (
          <span key={tag} style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.5rem',
            color: '#888',
            letterSpacing: '0.08em',
            border: '1px solid #ddd',
            padding: '0.1em 0.4em',
            textTransform: 'uppercase',
          }}>
            {tag}
          </span>
        ))}
        <Link href={`/challenges/${name}`} style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.55rem',
          color: '#888',
          letterSpacing: '0.06em',
          textDecoration: 'none',
          marginLeft: 'auto',
        }}>
          ← BACK TO CHALLENGE DISPATCH
        </Link>
      </div>

      {/* Headline */}
      <h1 style={{
        fontFamily: 'var(--font-playfair), serif',
        fontSize: '2.2rem',
        fontWeight: '800',
        color: '#111',
        lineHeight: 1.1,
        marginBottom: '0.4rem',
      }}>
        {challenge.name}
      </h1>

      {/* Dateline */}
      <div style={{
        borderBottom: '1px solid #111',
        paddingBottom: '0.75rem',
        marginBottom: '1.5rem',
      }}>
        <p style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.6rem',
          color: '#555',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          marginBottom: '0.25rem',
        }}>
          SAN FRANCISCO — {nowStr} — SESSION ID: {uuid.slice(0, 8).toUpperCase()}
        </p>
        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: '0.88rem',
          fontStyle: 'italic',
          color: '#555',
          lineHeight: 1.5,
        }}>
          {challenge.description}
        </p>
      </div>

      {/* Session credentials panel */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={monoSection}>TRANSMISSION CREDENTIALS</div>

        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          {/* Session ID */}
          <div>
            <span style={monoLabel}>Session ID</span>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#333' }}>
              <CopyableInvite
                invite={uuid}
                copyText={`${origin}/challenges/${name}/${uuid}`}
                className="text-sm flex items-center gap-2 group cursor-pointer transition-colors"
                showButton={false}
              />
            </div>
          </div>
        </div>

        {/* Invites */}
        {invites && invites.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <span style={monoLabel}>
              Dispatch Invites{' '}
              <Link href="/docs" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.52rem', color: '#888', textDecoration: 'none', letterSpacing: '0.04em', textTransform: 'none' }}>
                (how to join?)
              </Link>
            </span>
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
        <div style={{
          border: '2px solid #cc0000',
          padding: '1rem',
          marginBottom: '1.5rem',
        }}>
          <div style={{ ...monoSection, borderTop: 'none', color: '#cc0000' }}>DISPATCH INVITATION RECEIVED</div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: '#333', marginBottom: '0.75rem' }}>
            Your invite code:{' '}
            <code style={{ fontFamily: 'var(--font-mono)', background: '#f0ede6', padding: '0.1em 0.4em', border: '1px solid #ddd', fontSize: '0.82rem' }}>
              {invite}
            </code>
          </p>
          <ol style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: '#333', paddingLeft: '1.25rem', lineHeight: 1.8 }}>
            <li>Read the instructions at <a href="/SKILL.md" style={{ textDecoration: 'underline', color: '#cc0000', fontFamily: 'var(--font-mono)' }}>/SKILL.md</a></li>
            <li>Join the game using your invite code</li>
          </ol>
        </div>
      )}

      {/* Challenge brief */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={monoSection}>CHALLENGE BRIEF — CLASSIFIED TRANSMISSION</div>
        <ChallengePrompt prompt={challenge.prompt} />
      </div>

      {/* Game transcript */}
      <div style={{ borderTop: '3px double #111', paddingTop: '1rem' }}>
        <div style={monoSection}>GAME TRANSCRIPT — RESULTS TABLE</div>
        <ConversationsList uuid={uuid} engineUrl={PUBLIC_ENGINE_URL} />
      </div>
    </div>
  );
}
