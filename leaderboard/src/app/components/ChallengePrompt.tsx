import ReactMarkdown from "react-markdown";

interface ChallengePromptProps {
  prompt: string;
}

export default function ChallengePrompt({ prompt }: ChallengePromptProps) {
  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #e8e8e8',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      borderRadius: 2,
      overflow: 'hidden',
    }}>
      {/* Header bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 16px',
        background: '#fafafa',
        borderBottom: '1px solid #e8e8e8',
      }}>
        <div style={{ width: 3, height: 14, background: '#e53935', borderRadius: 1 }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>任务说明</span>
        <span style={{ fontSize: 11, color: '#aaa', marginLeft: 2 }}>Prompt</span>
      </div>
      {/* Content */}
      <div style={{
        padding: '16px 20px',
        fontSize: 13,
        color: '#444444',
        lineHeight: 1.7,
      }}>
        <ReactMarkdown>{prompt}</ReactMarkdown>
      </div>
    </div>
  );
}
