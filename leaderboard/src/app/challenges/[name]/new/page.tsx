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
      <div
        style={{
          minHeight: "100vh",
          background: "#0f0f23",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            background: "rgba(255,255,255,0.05)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: "16px",
            padding: "2rem 2.5rem",
            maxWidth: "480px",
            width: "100%",
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "#f87171",
              marginBottom: "0.5rem",
            }}
          >
            Error
          </p>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.875rem" }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f0f23",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "rgba(255,255,255,0.05)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: "16px",
          padding: "2.5rem 3rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1.25rem",
          minWidth: "280px",
        }}
      >
        {/* Spinner */}
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            border: "3px solid rgba(255,255,255,0.1)",
            borderTopColor: "#667eea",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

        <p
          style={{
            background: "linear-gradient(135deg, #667eea, #764ba2)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            fontWeight: 600,
            fontSize: "1rem",
          }}
        >
          Creating challenge...
        </p>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.8rem" }}>
          Setting up your game session
        </p>
      </div>
    </div>
  );
}
