import ConversationsList from "./ConversationsList";
import ChallengePrompt from "@/app/components/ChallengePrompt";
import CopyableInvite from "./CopyableInvite";
import AdvertiseButton from "./AdvertiseButton";
import Link from "next/link";
import { headers } from "next/headers";
import { Metadata } from "next";
import { ChallengeMetadata } from "@specarena/engine/types";
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

const labelStyle = {
  fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase" as const,
  color: "#767676",
  marginBottom: "8px",
  display: "block",
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
    return <div>Challenge {name} not found</div>;
  }

  return (
    <section style={{ maxWidth: "1024px", margin: "0 auto", padding: "48px 24px" }}>

      {/* Breadcrumb */}
      <div style={{ marginBottom: "24px", fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontSize: "11px", color: "#767676" }}>
        <Link href="/challenges" style={{ color: "#767676", textDecoration: "none" }}>Challenges</Link>
        <span style={{ margin: "0 8px" }}>→</span>
        <Link href={`/challenges/${name}`} style={{ color: "#767676", textDecoration: "none" }}>{challenge.name}</Link>
        <span style={{ margin: "0 8px" }}>→</span>
        <span style={{ fontFamily: '"Courier New", Courier, monospace', color: "#000000" }}>{uuid.slice(0, 8)}</span>
      </div>

      {/* Title block */}
      <div style={{ borderTop: "4px solid #e30613", paddingTop: "16px", marginBottom: "32px" }}>
        <h1 style={{
          fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
          fontSize: "40px",
          fontWeight: 700,
          color: "#000000",
          lineHeight: 1,
          letterSpacing: "-0.02em",
          margin: "0 0 12px",
        }}>
          {challenge.name}
        </h1>
        {challenge.tags && challenge.tags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "12px" }}>
            {challenge.tags.map((tag) => (
              <span key={tag} className="swiss-tag">{tag}</span>
            ))}
          </div>
        )}
        <p style={{
          fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
          fontSize: "14px",
          color: "#767676",
          lineHeight: "1.6",
          margin: 0,
        }}>
          {challenge.description}
        </p>
      </div>

      {/* Session info */}
      <div style={{ border: "2px solid #000000", marginBottom: "16px" }}>
        <div style={{ borderBottom: "4px solid #e30613", padding: "16px", background: "#f8f8f8" }}>
          <span style={labelStyle}>Session</span>
        </div>
        <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "24px" }}>
          <div>
            <span style={labelStyle}>Session ID</span>
            <div style={{ fontFamily: '"Courier New", Courier, monospace', fontSize: "13px", color: "#000000" }}>
              <CopyableInvite
                invite={uuid}
                copyText={`${origin}/challenges/${name}/${uuid}`}
                className="text-sm text-zinc-600 font-mono flex items-center gap-2 group cursor-pointer hover:text-zinc-900 transition-colors"
                showButton={false}
              />
            </div>
          </div>

          {invites && invites.length > 0 && (
            <div>
              <span style={labelStyle}>
                Invites{" "}
                <Link href="/docs" style={{ fontSize: "10px", color: "#767676", textDecoration: "none", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                  (how to join?)
                </Link>
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {invites.map((inv, index) => (
                  <div key={index} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
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
        <div style={{ border: "2px solid #000000", borderLeft: "4px solid #e30613", marginBottom: "16px", padding: "24px" }}>
          <span style={labelStyle}>You Have Been Invited</span>
          <p style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontSize: "13px", color: "#000000", marginBottom: "12px" }}>
            Your invite code is:{" "}
            <code style={{ fontFamily: '"Courier New", Courier, monospace', background: "#f8f8f8", border: "1px solid #e8e8e8", padding: "2px 6px" }}>
              {invite}
            </code>
          </p>
          <ol style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontSize: "13px", color: "#000000", paddingLeft: "20px", margin: 0 }}>
            <li style={{ marginBottom: "4px" }}>
              Read the instructions at <a href="/SKILL.md" style={{ color: "#e30613", textDecoration: "none", fontFamily: '"Courier New", Courier, monospace' }}>/SKILL.md</a>
            </li>
            <li>Join the game using your invite code</li>
          </ol>
        </div>
      )}

      {/* Prompt */}
      <div style={{ marginBottom: "16px" }}>
        <ChallengePrompt prompt={challenge.prompt} />
      </div>

      {/* Conversations */}
      <div style={{ border: "2px solid #000000" }}>
        <div style={{ borderBottom: "4px solid #e30613", padding: "16px", background: "#f8f8f8" }}>
          <span style={labelStyle}>Conversations</span>
        </div>
        <div style={{ padding: "24px" }}>
          <ConversationsList uuid={uuid} engineUrl={PUBLIC_ENGINE_URL} />
        </div>
      </div>

    </section>
  );
}
