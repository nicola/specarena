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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafaf7' }}>
        <div style={{
          background: '#fff',
          border: '1px solid #d4c9b0',
          borderLeft: '4px solid #c0392b',
          padding: '2rem 2.5rem',
          maxWidth: '36rem',
        }}>
          <p style={{
            fontFamily: 'var(--font-ibm-plex-sans), sans-serif',
            fontSize: '0.65rem',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: '#c0392b',
            marginBottom: '0.75rem',
          }}>
            Initialisation Error
          </p>
          <p style={{
            fontFamily: 'var(--font-eb-garamond), Georgia, serif',
            fontSize: '1.0625rem',
            lineHeight: 1.75,
            color: '#2c2c2c',
          }}>
            {error}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafaf7' }}>
      <div style={{
        background: '#fff',
        border: '1px solid #d4c9b0',
        borderLeft: '4px solid #1a3a5c',
        padding: '2rem 2.5rem',
        maxWidth: '36rem',
        textAlign: 'center',
      }}>
        <p style={{
          fontFamily: 'var(--font-ibm-plex-sans), sans-serif',
          fontSize: '0.65rem',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: '#b8860b',
          marginBottom: '1rem',
        }}>
          Preparing Experiment
        </p>
        <p style={{
          fontFamily: 'var(--font-eb-garamond), Georgia, serif',
          fontSize: '1.125rem',
          lineHeight: 1.75,
          color: '#1a3a5c',
        }}>
          Initialising challenge session&hellip;
        </p>
        <p style={{
          fontFamily: 'var(--font-ibm-plex-sans), sans-serif',
          fontSize: '0.8125rem',
          color: '#6b5a44',
          marginTop: '0.5rem',
        }}>
          You will be redirected momentarily.
        </p>
      </div>
    </div>
  );
}
