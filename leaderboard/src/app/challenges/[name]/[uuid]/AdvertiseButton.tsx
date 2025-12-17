"use client";

import { useState } from "react";
import { MegaphoneIcon, CheckIcon } from "@heroicons/react/24/outline";

interface AdvertiseButtonProps {
  inviteId: string;
}

export default function AdvertiseButton({ inviteId }: AdvertiseButtonProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleAdvertise = async () => {
    setLoading(true);
    
    try {
      const response = await fetch("/api/invites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inviteId }),
      });

      if (!response.ok) {
        throw new Error("Failed to advertise invite");
      }

      setSuccess(true);
    } catch (err) {
      console.error("Error advertising invite:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleAdvertise}
      disabled={loading || success}
      className="flex items-center gap-1 px-2 py-1 text-xs font-mono font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-zinc-300 rounded flex-shrink-0"
    >
      {loading ? (
        <>
          <span>...</span>
          <MegaphoneIcon className="w-4 h-4" />
        </>
      ) : success ? (
        <>
          <span>advertise</span>
          <CheckIcon className="w-4 h-4 text-green-600" />
        </>
      ) : (
        <>
          <span>advertise</span>
          <MegaphoneIcon className="w-4 h-4" />
        </>
      )}
    </button>
  );
}
