import ReactMarkdown from "react-markdown";

interface ChallengePromptProps {
  prompt: string;
}

export default function ChallengePrompt({ prompt }: ChallengePromptProps) {
  return (
    <div style={{ borderTop: '3px double #111111', paddingTop: '1rem' }}>
      <h2 style={{
        fontFamily: 'var(--font-playfair), serif',
        fontSize: '0.75rem',
        fontVariant: 'small-caps',
        letterSpacing: '0.1em',
        color: '#8b0000',
        marginBottom: '0.75rem',
        fontWeight: 700,
      }}>
        Challenge Prompt
      </h2>
      <div style={{
        fontFamily: 'var(--font-lora), serif',
        fontSize: '0.88rem',
        lineHeight: 1.7,
        color: '#111111',
      }}>
        <ReactMarkdown>{prompt}</ReactMarkdown>
      </div>
    </div>
  );
}
