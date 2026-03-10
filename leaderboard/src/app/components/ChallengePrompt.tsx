"use client";

import dynamic from "next/dynamic";

const ReactMarkdown = dynamic(() => import("react-markdown"), { ssr: false });

interface ChallengePromptProps {
  prompt: string;
}

export default function ChallengePrompt({ prompt }: ChallengePromptProps) {
  return (
    <div className="px-8 py-8" style={{ border: '1px solid #eeeeee' }}>
      <h2 className="text-xs font-medium mb-6 uppercase tracking-widest" style={{ color: '#aaaaaa', letterSpacing: '0.2em' }}>Prompt</h2>
      <div className="text-xs leading-relaxed" style={{ color: '#1a1a1a' }}>
        <ReactMarkdown>{prompt}</ReactMarkdown>
      </div>
    </div>
  );
}
