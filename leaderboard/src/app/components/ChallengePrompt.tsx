"use client";

import ReactMarkdown from "react-markdown";

interface ChallengePromptProps {
  prompt: string;
}

export default function ChallengePrompt({ prompt }: ChallengePromptProps) {
  return (
    <div className="border border-zinc-900 p-8">
      <h2 className="text-lg font-semibold text-zinc-900 mb-2">Prompt</h2>
      <div className="text-sm text-zinc-900">
        <ReactMarkdown>{prompt}</ReactMarkdown>
      </div>
    </div>
  );
}

