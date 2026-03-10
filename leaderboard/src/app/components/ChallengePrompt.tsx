"use client";

import dynamic from "next/dynamic";

const ReactMarkdown = dynamic(() => import("react-markdown"), { ssr: false });

interface ChallengePromptProps {
  prompt: string;
}

export default function ChallengePrompt({ prompt }: ChallengePromptProps) {
  return (
    <div className="glass rounded-xl p-8">
      <h2 className="text-lg font-semibold gradient-text mb-4">Prompt</h2>
      <div className="text-sm text-white/70 leading-relaxed [&_h1]:text-xl [&_h1]:font-semibold [&_h1]:gradient-text [&_h1]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:gradient-text [&_h2]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-white/90 [&_h3]:mb-2 [&_p]:mb-3 [&_p]:text-white/70 [&_ul]:text-white/70 [&_ol]:text-white/70 [&_li]:text-white/70 [&_code]:bg-white/10 [&_code]:text-purple-300 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_pre]:bg-white/5 [&_pre]:border [&_pre]:border-white/10 [&_pre]:rounded-lg [&_pre]:p-4 [&_pre]:overflow-x-auto [&_pre]:mb-4 [&_blockquote]:border-l-2 [&_blockquote]:border-purple-500/50 [&_blockquote]:pl-4 [&_blockquote]:text-white/50 [&_blockquote]:italic [&_a]:text-purple-400 [&_a]:hover:text-purple-300 [&_strong]:text-white/90">
        <ReactMarkdown>{prompt}</ReactMarkdown>
      </div>
    </div>
  );
}
