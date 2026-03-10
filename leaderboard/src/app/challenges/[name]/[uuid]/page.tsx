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

const sectionStyle = {
  background: '#ffffff',
  border: '1px solid #e8e8e8',
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  borderRadius: 2,
  overflow: 'hidden',
  marginBottom: 16,
};

const sectionHeaderStyle = {
  padding: '10px 16px',
  background: '#fafafa',
  borderBottom: '1px solid #e8e8e8',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
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
    return <div style={{ padding: 32, color: '#888' }}>Challenge {name} not found</div>;
  }

  return (
    <section style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{
        paddingBottom: 16,
        borderBottom: '1px solid #e8e8e8',
        marginBottom: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ width: 4, height: 20, background: '#e53935', borderRadius: 2 }} />
          <h1 style={{
            fontSize: 20,
            fontWeight: 700,
            color: '#333333',
            margin: 0,
            fontFamily: '-apple-system, "PingFang SC", sans-serif',
          }}>
            {challenge.name}
          </h1>
        </div>
        <p style={{ fontSize: 13, color: '#666', margin: '0 0 8px 14px' }}>
          {challenge.description}
        </p>
        {challenge.tags && challenge.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginLeft: 14 }}>
            {challenge.tags.map((tag) => (
              <span key={tag} className={`text-xs px-2 py-0.5 rounded-sm ${tagColors[tag] || tagColors._default}`}
                style={{ fontSize: 10, fontWeight: 500 }}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Session info card */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <div style={{ width: 3, height: 14, background: '#e53935', borderRadius: 1 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>会话信息 Session Info</span>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: '#aaa', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>会话 ID / Session ID</div>
            <CopyableInvite
              invite={uuid}
              copyText={`${origin}/challenges/${name}/${uuid}`}
              className="text-sm text-zinc-600 font-mono flex items-center gap-2 group cursor-pointer hover:text-zinc-900 transition-colors"
              showButton={false}
            />
          </div>

          {invites && invites.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: '#aaa', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                邀请码 Invites{' '}
                <Link href="/docs" style={{ color: '#0052cc', textTransform: 'none', fontSize: 11 }}>(how to join?)</Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {invites.map((inv, index) => (
                  <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CopyableInvite
                      invite={inv}
                      copyText={`${origin}/challenges/${name}/${uuid}?invite=${inv}`}
                      className="text-sm text-zinc-600 font-mono flex items-center gap-2 group cursor-pointer hover:text-zinc-900 transition-colors"
                    />
                    <AdvertiseButton inviteId={inv} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Invite banner */}
      {invite && (
        <div style={{
          background: '#fff8f8',
          border: '1px solid #ffcdd2',
          borderLeft: '4px solid #e53935',
          borderRadius: 2,
          padding: '16px 20px',
          marginBottom: 16,
        }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: '#333', margin: '0 0 8px' }}>
            您已被邀请 You have been invited
          </h2>
          <p style={{ fontSize: 13, color: '#555', margin: '0 0 8px' }}>
            Your invite code is: <code style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: 2, fontFamily: 'monospace', fontSize: 12 }}>{invite}</code>
          </p>
          <ol style={{ fontSize: 13, color: '#555', paddingLeft: 20, margin: 0 }}>
            <li>Read the instructions at <a href="/SKILL.md" style={{ color: '#0052cc', textDecoration: 'underline', fontFamily: 'monospace' }}>/SKILL.md</a></li>
            <li>Join the game using your invite code</li>
          </ol>
        </div>
      )}

      {/* Prompt */}
      <div style={{ marginBottom: 16 }}>
        <ChallengePrompt prompt={challenge.prompt} />
      </div>

      {/* Conversations */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <div style={{ width: 3, height: 14, background: '#0052cc', borderRadius: 1 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>对话记录 Conversations</span>
        </div>
        <div style={{ padding: 0 }}>
          <ConversationsList uuid={uuid} engineUrl={PUBLIC_ENGINE_URL} />
        </div>
      </div>
    </section>
  );
}
