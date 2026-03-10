"use client";

import dynamic from "next/dynamic";

const ReactMarkdown = dynamic(() => import("react-markdown"), { ssr: false });

interface ChallengePromptProps {
  prompt: string;
}

export default function ChallengePrompt({ prompt }: ChallengePromptProps) {
  return (
    <div className="border border-[#00ff00] font-mono">
      <div className="border-b border-[#00ff00] px-3 py-1 bg-[#001100]">
        <span className="text-[#00ff00] text-xs font-bold">DESCRIPTION</span>
        <span className="text-[#006600] text-xs ml-3">-- man page excerpt</span>
      </div>
      <div className="p-4 text-sm text-[#00aa00] challenge-prompt-terminal">
        <ReactMarkdown
          components={{
            h1: ({ children }) => (
              <div className="text-[#00ff00] font-bold uppercase mb-3 mt-4 first:mt-0">{children}</div>
            ),
            h2: ({ children }) => (
              <div className="text-[#00ff00] font-bold uppercase mb-2 mt-4 first:mt-0">{children}</div>
            ),
            h3: ({ children }) => (
              <div className="text-[#00aa00] font-bold mb-2 mt-3">{children}</div>
            ),
            p: ({ children }) => (
              <p className="mb-3 leading-relaxed">{children}</p>
            ),
            code: ({ children, className }) => {
              const isBlock = className?.includes('language-');
              if (isBlock) {
                return (
                  <pre className="bg-[#001100] border border-[#003300] p-3 mb-3 overflow-x-auto text-[#00ff00] text-xs">
                    <code>{children}</code>
                  </pre>
                );
              }
              return (
                <code className="bg-[#001100] border border-[#003300] px-1 text-[#00ff00] text-xs">{children}</code>
              );
            },
            pre: ({ children }) => (
              <pre className="bg-[#001100] border border-[#003300] p-3 mb-3 overflow-x-auto text-[#00ff00] text-xs">{children}</pre>
            ),
            ul: ({ children }) => (
              <ul className="mb-3 space-y-1 pl-4">{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="mb-3 space-y-1 pl-4 list-decimal list-inside">{children}</ol>
            ),
            li: ({ children }) => (
              <li className="text-[#00aa00] before:content-['-'] before:mr-2 before:text-[#006600] list-none">{children}</li>
            ),
            strong: ({ children }) => (
              <strong className="text-[#00ff00] font-bold">{children}</strong>
            ),
            em: ({ children }) => (
              <em className="text-[#00cc00] not-italic underline">{children}</em>
            ),
            blockquote: ({ children }) => (
              <blockquote className="border-l-2 border-[#006600] pl-3 mb-3 text-[#006600] italic">{children}</blockquote>
            ),
            a: ({ href, children }) => (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#00ff00] underline hover:text-white">{children}</a>
            ),
            hr: () => (
              <div className="my-4 text-[#003300]">{'─'.repeat(40)}</div>
            ),
          }}
        >
          {prompt}
        </ReactMarkdown>
      </div>
    </div>
  );
}
