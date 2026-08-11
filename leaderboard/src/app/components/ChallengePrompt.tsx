import ReactMarkdown from "react-markdown";

interface ChallengePromptProps {
  prompt: string;
}

export default function ChallengePrompt({ prompt }: ChallengePromptProps) {
  return (
    <div className="px-3 py-2" style={{ border: '1px solid #dee2e6', background: '#fff' }}>
      <h2 className="font-semibold mb-1.5" style={{ color: '#212529', fontSize: '13px' }}>Prompt</h2>
      <div className="compact-prose" style={{ color: '#212529', fontSize: '12px', lineHeight: 1.5 }}>
        <ReactMarkdown>{prompt}</ReactMarkdown>
      </div>
    </div>
  );
}
