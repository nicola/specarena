"use client";

import dynamic from "next/dynamic";

const ReactMarkdown = dynamic(() => import("react-markdown"), { ssr: false });

interface ChallengePromptProps {
  prompt: string;
}

const amber = '#ffb000';
const amberDim = '#cc8800';
const amberBright = '#ffcc44';
const bg = '#0d0a00';

export default function ChallengePrompt({ prompt }: ChallengePromptProps) {
  return (
    <div style={{
      border: `1px solid ${amber}`,
      padding: '2rem',
      background: bg,
      fontFamily: '"Courier New", monospace',
    }}>
      <h2 style={{
        fontSize: '0.85rem',
        fontWeight: 'bold',
        color: amberBright,
        textShadow: `0 0 8px ${amberBright}`,
        marginBottom: '0.75rem',
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
      }}>
        ── PROMPT ──
      </h2>
      <div style={{
        fontSize: '0.82rem',
        color: amber,
        textShadow: `0 0 6px ${amber}`,
        lineHeight: 1.7,
        whiteSpace: 'pre-wrap',
      }}>
        <ReactMarkdown
          components={{
            h1: ({children}) => <h1 style={{ color: amberBright, textShadow: `0 0 8px ${amberBright}`, fontSize: '1.1rem', marginBottom: '0.5rem' }}>{children}</h1>,
            h2: ({children}) => <h2 style={{ color: amberBright, textShadow: `0 0 8px ${amberBright}`, fontSize: '1rem', marginBottom: '0.5rem' }}>{children}</h2>,
            h3: ({children}) => <h3 style={{ color: amberBright, fontSize: '0.9rem', marginBottom: '0.5rem' }}>{children}</h3>,
            p: ({children}) => <p style={{ color: amber, textShadow: `0 0 6px ${amber}`, marginBottom: '0.5rem' }}>{children}</p>,
            code: ({children}) => <code style={{ color: amberBright, background: '#1a1400', padding: '0.1rem 0.3rem', fontFamily: '"Courier New", monospace' }}>{children}</code>,
            pre: ({children}) => <pre style={{ background: '#1a1400', border: `1px solid ${amberDim}`, padding: '1rem', overflowX: 'auto', marginBottom: '0.75rem' }}>{children}</pre>,
            ul: ({children}) => <ul style={{ color: amber, paddingLeft: '1.5rem', marginBottom: '0.5rem' }}>{children}</ul>,
            ol: ({children}) => <ol style={{ color: amber, paddingLeft: '1.5rem', marginBottom: '0.5rem' }}>{children}</ol>,
            li: ({children}) => <li style={{ marginBottom: '0.25rem' }}>{children}</li>,
            strong: ({children}) => <strong style={{ color: amberBright, textShadow: `0 0 8px ${amberBright}` }}>{children}</strong>,
            em: ({children}) => <em style={{ color: amberDim }}>{children}</em>,
          }}
        >{prompt}</ReactMarkdown>
      </div>
    </div>
  );
}
