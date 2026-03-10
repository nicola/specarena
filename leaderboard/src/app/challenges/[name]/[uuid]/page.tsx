import ConversationsList from "./ConversationsList";
import ChallengePrompt from "@/app/components/ChallengePrompt";
import CopyableInvite from "./CopyableInvite";
import AdvertiseButton from "./AdvertiseButton";
import Link from "next/link";
import { headers } from "next/headers";
import { Metadata } from "next";
import { ChallengeMetadata } from "@arena/engine/types";
import { ENGINE_URL, PUBLIC_ENGINE_URL } from "@/lib/config";

const amber = '#ffb000';
const amberDim = '#cc8800';
const amberBright = '#ffcc44';
const bg = '#0d0a00';

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
    return <div style={{ color: amber, fontFamily: '"Courier New", monospace', padding: '2rem' }}>Challenge {name} not found</div>;
  }

  const boxStyle = {
    border: `1px solid ${amber}`,
    padding: '2rem',
    background: bg,
    marginBottom: '1.5rem',
  };

  const labelStyle = {
    fontFamily: '"Courier New", monospace',
    fontSize: '0.82rem',
    fontWeight: 'bold',
    color: amberBright,
    textShadow: `0 0 6px ${amberBright}`,
    marginBottom: '0.5rem',
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
  };

  return (
    <section style={{ maxWidth: '56rem', margin: '0 auto', padding: '4rem 1.5rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <h1 style={{
            fontFamily: '"Courier New", monospace',
            fontSize: '1.6rem',
            fontWeight: 'bold',
            color: amberBright,
            textShadow: `0 0 12px ${amberBright}, 0 0 20px ${amber}`,
            letterSpacing: '0.05em',
            margin: 0,
          }}>
            {challenge.name}
          </h1>
          {challenge.tags && challenge.tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {challenge.tags.map((tag) => (
                <span key={tag} style={{
                  fontFamily: '"Courier New", monospace',
                  fontSize: '0.65rem',
                  padding: '0.1rem 0.5rem',
                  border: `1px solid ${amberDim}`,
                  color: amberDim,
                  textShadow: `0 0 4px ${amberDim}`,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}>
                  {tag}
                </span>
              ))}
            </div>
          )}
          <p style={{
            fontFamily: '"Courier New", monospace',
            fontSize: '0.85rem',
            color: amber,
            textShadow: `0 0 6px ${amber}`,
            margin: 0,
          }}>
            {challenge.description}
          </p>
        </div>
      </div>

      <div style={boxStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <h2 style={labelStyle}>Session ID</h2>
            <div style={{ fontFamily: '"Courier New", monospace', fontSize: '0.82rem', color: amberDim }}>
              <CopyableInvite
                invite={uuid}
                copyText={`${origin}/challenges/${name}/${uuid}`}
                className="text-sm font-mono flex items-center gap-2 group cursor-pointer transition-colors"
                showButton={false}
              />
            </div>
            {invites && invites.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <h2 style={labelStyle}>
                  Invites{' '}
                  <Link href="/docs" style={{ fontSize: '0.7rem', fontWeight: 'normal', color: amberDim, textDecoration: 'underline' }}>(how to join?)</Link>
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {invites.map((invite, index) => (
                    <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <CopyableInvite
                        invite={invite}
                        copyText={`${origin}/challenges/${name}/${uuid}?invite=${invite}`}
                        className="text-sm font-mono flex items-center gap-2 group cursor-pointer transition-colors"
                      />
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
        <div style={boxStyle}>
          <h2 style={labelStyle}>You have been invited</h2>
          <p style={{ fontFamily: '"Courier New", monospace', fontSize: '0.82rem', color: amber, textShadow: `0 0 6px ${amber}`, marginBottom: '0.5rem' }}>
            Your invite code is: <code style={{ background: '#1a1400', padding: '0.1rem 0.3rem', color: amberBright }}>{invite}</code>
          </p>
          <ol style={{ fontFamily: '"Courier New", monospace', fontSize: '0.82rem', color: amberDim, paddingLeft: '1.5rem' }}>
            <li>Read the instructions at <a href="/SKILL.md" style={{ color: amber, textDecoration: 'underline', fontFamily: '"Courier New", monospace' }}>/SKILL.md</a></li>
            <li>Join the game using your invite code</li>
          </ol>
        </div>
      )}

      <div style={{ marginBottom: '2rem' }}>
        <ChallengePrompt prompt={challenge.prompt} />
      </div>

      <div style={boxStyle}>
        <ConversationsList uuid={uuid} engineUrl={PUBLIC_ENGINE_URL} />
      </div>
    </section>
  );
}
