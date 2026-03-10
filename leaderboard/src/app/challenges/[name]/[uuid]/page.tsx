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

  // Get the origin from headers for client-side URLs
  const headersList = await headers();
  const host = headersList.get("host") || "";
  const protocol = headersList.get("x-forwarded-proto") || "http";
  const origin = `${protocol}://${host}`;

  const challenge = await fetchMetadata(name);
  if (!challenge) {
    return (
      <div style={{ minHeight: "100vh", background: "#0f0f23", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "rgba(255,255,255,0.6)" }}>Challenge {name} not found</div>
      </div>
    );
  }

  return (
    <section className="max-w-4xl mx-auto px-6 py-16" style={{ minHeight: "100vh" }}>
        <div className="flex flex-col gap-6 mb-10">
          <div className="flex flex-col gap-2">
            <h1
              className="text-3xl font-semibold"
              style={{
                fontFamily: 'var(--font-jost), sans-serif',
                background: "linear-gradient(135deg, #667eea, #764ba2)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {challenge.name}
            </h1>
            {challenge.tags && challenge.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {challenge.tags.map((tag) => (
                  <span
                    key={tag}
                    className={`text-xs px-2 py-0.5 rounded-full ${tagColors[tag] || tagColors._default}`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <p className="text-base" style={{ color: "rgba(255,255,255,0.6)" }}>
              {challenge.description}
            </p>
          </div>
        </div>

        {/* Session ID & Invites */}
        <div
          className="max-w-4xl mx-auto p-8 mb-6"
          style={{
            background: "rgba(255,255,255,0.05)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: "16px",
          }}
        >
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="text-lg font-semibold mb-2" style={{ color: "white" }}>Session ID</h2>
              <div
                className="inline-flex items-center px-3 py-1.5 font-mono text-sm"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: "9999px",
                  color: "rgba(255,255,255,0.7)",
                }}
              >
                <CopyableInvite
                  invite={uuid}
                  copyText={`${origin}/challenges/${name}/${uuid}`}
                  className="text-sm font-mono flex items-center gap-2 group cursor-pointer transition-colors"
                  style={{
                    background: "linear-gradient(135deg, #667eea, #764ba2)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                  showButton={false}
                />
              </div>
              {invites && invites.length > 0 && (
                <div className="mt-4">
                  <h2 className="text-lg font-semibold mb-2" style={{ color: "white" }}>
                    Invites{" "}
                    <Link href="/docs" className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
                      (how to join?)
                    </Link>
                  </h2>
                  <div className="list-none space-y-2">
                    {invites.map((invite, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div
                          className="inline-flex items-center px-3 py-1.5 font-mono text-sm"
                          style={{
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.15)",
                            borderRadius: "9999px",
                          }}
                        >
                          <CopyableInvite
                            invite={invite}
                            copyText={`${origin}/challenges/${name}/${uuid}?invite=${invite}`}
                            className="text-sm font-mono flex items-center gap-2 group cursor-pointer transition-colors"
                            style={{
                              background: "linear-gradient(135deg, #667eea, #764ba2)",
                              WebkitBackgroundClip: "text",
                              WebkitTextFillColor: "transparent",
                            }}
                          />
                        </div>
                        <AdvertiseButton inviteId={invite} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* You have been invited */}
        {invite && (
          <div
            className="max-w-4xl mx-auto p-8 mb-6"
            style={{
              background: "rgba(255,255,255,0.05)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "16px",
            }}
          >
            <h2
              className="text-lg font-semibold mb-2"
              style={{
                background: "linear-gradient(135deg, #667eea, #764ba2)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              You have been invited
            </h2>
            <p className="text-sm mb-2" style={{ color: "rgba(255,255,255,0.6)" }}>
              Your invite code is:{" "}
              <code
                className="px-2 py-0.5 rounded font-mono text-sm"
                style={{
                  background: "rgba(102,126,234,0.15)",
                  border: "1px solid rgba(102,126,234,0.3)",
                  color: "#a78bfa",
                }}
              >
                {invite}
              </code>
            </p>
            <ol className="list-decimal list-inside space-y-1 text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
              <li>
                Read the instructions at{" "}
                <a href="/SKILL.md" className="underline font-mono" style={{ color: "#a78bfa" }}>
                  /SKILL.md
                </a>
              </li>
              <li>Join the game using your invite code</li>
            </ol>
          </div>
        )}

        {/* Challenge Prompt */}
        <div className="mb-8">
          <ChallengePrompt prompt={challenge.prompt} />
        </div>

        {/* Conversations / Message Log */}
        <div
          className="max-w-4xl mx-auto p-8"
          style={{
            background: "rgba(255,255,255,0.05)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: "16px",
          }}
        >
          <ConversationsList uuid={uuid} engineUrl={PUBLIC_ENGINE_URL} />
        </div>

      </section>
  );
}
