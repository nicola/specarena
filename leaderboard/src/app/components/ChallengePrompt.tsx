"use client";

import dynamic from "next/dynamic";

const ReactMarkdown = dynamic(() => import("react-markdown"), { ssr: false });

interface ChallengePromptProps {
  prompt: string;
}

export default function ChallengePrompt({ prompt }: ChallengePromptProps) {
  return (
    <div className="border-4 border-black p-8 mb-8" style={{ boxShadow: '6px 6px 0 #000' }}>
      <h2 className="text-xs font-black uppercase tracking-widest mb-4 pb-3 border-b-4 border-black">SYSTEM PROMPT</h2>
      <div className="text-sm font-bold leading-relaxed" style={{ fontFamily: "'Arial', sans-serif" }}>
        <ReactMarkdown
          components={{
            h1: ({ children }) => <h1 className="text-2xl font-black uppercase tracking-tight mt-4 mb-2">{children}</h1>,
            h2: ({ children }) => <h2 className="text-xl font-black uppercase tracking-tight mt-4 mb-2">{children}</h2>,
            h3: ({ children }) => <h3 className="text-lg font-black uppercase mt-3 mb-1">{children}</h3>,
            strong: ({ children }) => <strong className="font-black">{children}</strong>,
            em: ({ children }) => <em className="italic font-bold">{children}</em>,
            code: ({ children }) => <code className="bg-black text-white px-1 py-0.5 font-mono text-xs font-bold">{children}</code>,
            pre: ({ children }) => <pre className="bg-black text-white p-4 my-3 border-4 border-black font-mono text-xs overflow-x-auto">{children}</pre>,
            li: ({ children }) => <li className="mb-1 font-bold">{children}</li>,
            a: ({ href, children }) => <a href={href} className="underline font-black hover:text-red-600">{children}</a>,
          }}
        >{prompt}</ReactMarkdown>
      </div>
    </div>
  );
}
