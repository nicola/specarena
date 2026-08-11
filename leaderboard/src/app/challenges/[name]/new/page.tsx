"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";

export default function NewChallengePage() {
  const router = useRouter();
  const params = useParams();
  const name = params.name as string;
  const [error, setError] = useState<string | null>(null);
  const hasCreatedRef = useRef(false);

  useEffect(() => {
    // Prevent duplicate challenge creation in React Strict Mode
    if (hasCreatedRef.current) {
      return;
    }
    hasCreatedRef.current = true;

    async function createChallenge() {
      try {
        // Call the challenges API to create a new challenge
        const response = await fetch(`/api/challenges/${name}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          let errorMessage = `HTTP error! status: ${response.status}`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch {
            // If response is not JSON, use status text or default message
            errorMessage = response.statusText || errorMessage;
          }
          throw new Error(errorMessage);
        }

        const data = await response.json();
        const { id, invites } = data;
        
        if (!id) {
          throw new Error("Missing challengeId in response");
        }
        
        // Build query string with invites
        const inviteParams = invites && invites.length > 0
          ? invites.map((invite: string) => `invites=${encodeURIComponent(invite)}`).join("&")
          : "";
        const redirectUrl = `/challenges/${name}/${id}${inviteParams ? `?${inviteParams}` : ""}`;
        
        router.replace(redirectUrl);
      } catch (err) {
        console.error("Error creating challenge:", err);
        setError(err instanceof Error ? err.message : "Failed to create challenge");
      }
    }

    createChallenge();
  }, [router, name]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#000' }}>
        <div
          className="p-8 relative"
          style={{ border: '1px solid #ff0090', boxShadow: '0 0 20px #ff009044', background: '#0a0005', fontFamily: 'var(--font-share-tech-mono), monospace' }}
        >
          <span style={{ position: 'absolute', top: -1, left: -1, width: 12, height: 12, borderTop: '2px solid #ff0090', borderLeft: '2px solid #ff0090' }} />
          <span style={{ position: 'absolute', top: -1, right: -1, width: 12, height: 12, borderTop: '2px solid #ff0090', borderRight: '2px solid #ff0090' }} />
          <span style={{ position: 'absolute', bottom: -1, left: -1, width: 12, height: 12, borderBottom: '2px solid #ff0090', borderLeft: '2px solid #ff0090' }} />
          <span style={{ position: 'absolute', bottom: -1, right: -1, width: 12, height: 12, borderBottom: '2px solid #ff0090', borderRight: '2px solid #ff0090' }} />
          <p className="text-[#ff0090] text-sm">&gt; ERROR: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#000' }}>
      <div
        className="p-10 relative"
        style={{ border: '1px solid #00ffff', boxShadow: '0 0 20px #00ffff44', background: '#020208', fontFamily: 'var(--font-share-tech-mono), monospace' }}
      >
        <span style={{ position: 'absolute', top: -1, left: -1, width: 16, height: 16, borderTop: '2px solid #00ffff', borderLeft: '2px solid #00ffff' }} />
        <span style={{ position: 'absolute', top: -1, right: -1, width: 16, height: 16, borderTop: '2px solid #00ffff', borderRight: '2px solid #00ffff' }} />
        <span style={{ position: 'absolute', bottom: -1, left: -1, width: 16, height: 16, borderBottom: '2px solid #00ffff', borderLeft: '2px solid #00ffff' }} />
        <span style={{ position: 'absolute', bottom: -1, right: -1, width: 16, height: 16, borderBottom: '2px solid #00ffff', borderRight: '2px solid #00ffff' }} />
        <div className="flex items-center gap-3">
          <span className="inline-block w-2 h-2 bg-[#00ffff] animate-pulse" />
          <span className="text-[#00ffff] text-sm tracking-wider" style={{ fontFamily: 'var(--font-orbitron), Orbitron, sans-serif' }}>
            INITIALIZING CHALLENGE...
          </span>
        </div>
        <p className="text-zinc-500 text-xs mt-2 ml-5">Connecting to arena engine</p>
      </div>
    </div>
  );
}

