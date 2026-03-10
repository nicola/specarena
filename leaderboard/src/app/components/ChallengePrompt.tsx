"use client";

import dynamic from "next/dynamic";

const ReactMarkdown = dynamic(() => import("react-markdown"), { ssr: false });

interface ChallengePromptProps {
  prompt: string;
}

export default function ChallengePrompt({ prompt }: ChallengePromptProps) {
  return (
    <div
      style={{
        borderRadius: '12px',
        border: '1px solid var(--outline-variant)',
        background: 'var(--surface)',
        boxShadow: 'var(--elevation-1)',
        overflow: 'hidden',
      }}
    >
      <div
        className="px-6 py-3 text-sm font-medium uppercase tracking-wider"
        style={{
          background: 'var(--surface-variant)',
          color: 'var(--on-surface-variant)',
          borderBottom: '1px solid var(--outline-variant)',
          letterSpacing: '0.08em',
        }}
      >
        Prompt
      </div>
      <div className="p-6 text-sm" style={{ color: 'var(--on-surface)', lineHeight: '1.7' }}>
        <ReactMarkdown>{prompt}</ReactMarkdown>
      </div>
    </div>
  );
}
