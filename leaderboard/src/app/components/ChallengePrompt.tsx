"use client";

import dynamic from "next/dynamic";

const ReactMarkdown = dynamic(() => import("react-markdown"), { ssr: false });

interface ChallengePromptProps {
  prompt: string;
}

export default function ChallengePrompt({ prompt }: ChallengePromptProps) {
  return (
    <div className="p-8" style={{ border: '1px solid #30363d', background: '#161b22' }}>
      <h2 className="text-lg font-semibold mb-2" style={{ color: '#e6edf3' }}>Prompt</h2>
      <div className="text-sm" style={{ color: '#c9d1d9' }}>
        <ReactMarkdown>{prompt}</ReactMarkdown>
      </div>
    </div>
  );
}
