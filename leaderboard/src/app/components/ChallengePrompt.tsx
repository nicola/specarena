"use client";

import dynamic from "next/dynamic";

const ReactMarkdown = dynamic(() => import("react-markdown"), { ssr: false });

interface ChallengePromptProps {
  prompt: string;
}

export default function ChallengePrompt({ prompt }: ChallengePromptProps) {
  return (
    <div className="border border-black p-8">
      <h2 className="text-lg font-black text-black mb-2" style={{ fontFamily: 'var(--font-jost), sans-serif' }}>Prompt</h2>
      <div className="text-sm text-[#1a1a1a] leading-relaxed">
        <ReactMarkdown>{prompt}</ReactMarkdown>
      </div>
    </div>
  );
}
