import ReactMarkdown from "react-markdown";

interface ChallengePromptProps {
  prompt: string;
}

export default function ChallengePrompt({ prompt }: ChallengePromptProps) {
  return (
    <div
      className="p-8"
      style={{
        background: '#faf6ef',
        border: '1px solid #d4c4a8',
        boxShadow: 'inset 0 1px 3px rgba(26,16,8,0.06)',
      }}
    >
      <h2
        className="text-lg font-semibold mb-4"
        style={{
          fontFamily: 'var(--font-noto-serif), serif',
          color: '#1a1008',
          borderBottom: '2px solid #cc2200',
          paddingBottom: '0.4rem',
          display: 'inline-block',
        }}
      >
        Prompt
      </h2>
      <div
        className="text-sm mt-4"
        style={{
          color: '#1a1008',
          fontFamily: 'var(--font-noto-sans), sans-serif',
          lineHeight: '1.8',
        }}
      >
        <ReactMarkdown>{prompt}</ReactMarkdown>
      </div>
    </div>
  );
}
