"use client";

import dynamic from "next/dynamic";

const ReactMarkdown = dynamic(() => import("react-markdown"), { ssr: false });

interface ChallengePromptProps {
  prompt: string;
}

export default function ChallengePrompt({ prompt }: ChallengePromptProps) {
  return (
    <div className="border border-[#00ffff] p-8 relative" style={{ background: '#020208', boxShadow: '0 0 15px #00ffff22' }}>
      {/* Corner brackets */}
      <span style={{ position: 'absolute', top: -1, left: -1, width: 12, height: 12, borderTop: '2px solid #00ffff', borderLeft: '2px solid #00ffff' }} />
      <span style={{ position: 'absolute', top: -1, right: -1, width: 12, height: 12, borderTop: '2px solid #00ffff', borderRight: '2px solid #00ffff' }} />
      <span style={{ position: 'absolute', bottom: -1, left: -1, width: 12, height: 12, borderBottom: '2px solid #00ffff', borderLeft: '2px solid #00ffff' }} />
      <span style={{ position: 'absolute', bottom: -1, right: -1, width: 12, height: 12, borderBottom: '2px solid #00ffff', borderRight: '2px solid #00ffff' }} />

      <h2 className="text-lg font-semibold text-[#00ffff] mb-4" style={{ fontFamily: 'var(--font-orbitron), Orbitron, sans-serif', textShadow: '0 0 8px #00ffff' }}>
        &gt; Prompt
      </h2>
      <div
        className="text-sm text-zinc-300 challenge-prompt-body"
        style={{ fontFamily: 'var(--font-share-tech-mono), monospace', lineHeight: '1.7' }}
      >
        <ReactMarkdown
          components={{
            h1: ({ children }) => (
              <h1 className="text-xl font-semibold text-[#00ffff] mt-6 mb-3" style={{ fontFamily: 'var(--font-orbitron), Orbitron, sans-serif', textShadow: '0 0 6px #00ffff' }}>{children}</h1>
            ),
            h2: ({ children }) => (
              <h2 className="text-lg font-semibold text-[#00ffff] mt-5 mb-2" style={{ fontFamily: 'var(--font-orbitron), Orbitron, sans-serif', textShadow: '0 0 6px #00ffff' }}>{children}</h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-base font-semibold text-[#00ffff] mt-4 mb-2" style={{ textShadow: '0 0 4px #00ffff' }}>{children}</h3>
            ),
            p: ({ children }) => (
              <p className="mb-3 text-zinc-300">{children}</p>
            ),
            ul: ({ children }) => (
              <ul className="list-none mb-3 space-y-1">{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="list-none mb-3 space-y-1 counter-reset-li">{children}</ol>
            ),
            li: ({ children }) => (
              <li className="text-zinc-300 pl-4 before:content-['>'] before:text-[#00ff41] before:mr-2">{children}</li>
            ),
            code: ({ children, className }) => {
              const isInline = !className;
              if (isInline) {
                return (
                  <code className="text-[#00ff41] px-1 py-0.5 text-sm" style={{ background: '#001a0a', border: '1px solid #00ff4133' }}>{children}</code>
                );
              }
              return <code className={className}>{children}</code>;
            },
            pre: ({ children }) => (
              <pre className="text-sm text-[#00ff41] font-mono p-4 overflow-x-auto mb-4" style={{ background: '#001a0a', border: '1px solid #00ff4144' }}>{children}</pre>
            ),
            strong: ({ children }) => (
              <strong className="text-white font-semibold">{children}</strong>
            ),
            a: ({ href, children }) => (
              <a href={href} className="text-[#00ffff] underline hover:text-white transition-colors">{children}</a>
            ),
            blockquote: ({ children }) => (
              <blockquote className="border-l-2 border-[#ff0090] pl-4 text-zinc-400 italic my-3">{children}</blockquote>
            ),
          }}
        >
          {prompt}
        </ReactMarkdown>
      </div>
    </div>
  );
}
