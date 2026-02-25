"use client";

import { useState } from "react";
import { ClipboardDocumentIcon, CheckIcon } from "@heroicons/react/24/outline";

interface CopyableInviteProps {
  invite: string;
  copyText?: string;
  className?: string;
  showButton?: boolean;
}

export default function CopyableInvite({ invite, copyText = invite, className, showButton = true }: CopyableInviteProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyText.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className={className}>
      <span className="select-all">{invite.trim()}</span>
      {showButton && (
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-1 text-xs font-mono font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 transition-colors border border-zinc-300 rounded flex-shrink-0"
        >
          <span>join</span>
          {copied ? (
            <CheckIcon className="w-4 h-4 text-green-600" />
          ) : (
            <ClipboardDocumentIcon className="w-4 h-4" />
          )}
        </button>
      )}
    </div>
  );
}

