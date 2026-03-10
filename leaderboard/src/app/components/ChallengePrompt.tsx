"use client";

import dynamic from "next/dynamic";

const ReactMarkdown = dynamic(() => import("react-markdown"), { ssr: false });

interface ChallengePromptProps {
  prompt: string;
}

export default function ChallengePrompt({ prompt }: ChallengePromptProps) {
  return (
    <div className="border border-zinc-200 rounded-sm shadow-sm p-8 bg-white">
      <h2 className="text-lg font-semibold text-zinc-900 mb-2">Prompt</h2>
      <div className="text-sm text-zinc-600 leading-relaxed">
        <ReactMarkdown>{prompt}</ReactMarkdown>
      </div>
    </div>
  );
}
