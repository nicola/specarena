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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-zinc-900">Creating challenge...</div>
    </div>
  );
}

