import ReactMarkdown from "react-markdown";

interface ChallengePromptProps {
  prompt: string;
}

export default function ChallengePrompt({ prompt }: ChallengePromptProps) {
  return (
    <div>
      <span style={{ display: "block", height: "4px", background: "#e30613", marginBottom: "0" }} />
      <div style={{
        border: "2px solid #000000",
        borderTop: "none",
        padding: "24px",
      }}>
        <div style={{
          fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
          fontSize: "10px",
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "#767676",
          marginBottom: "16px",
        }}>
          Challenge Prompt
        </div>
        <div style={{
          fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
          fontSize: "13px",
          color: "#000000",
          lineHeight: "1.6",
        }}>
          <ReactMarkdown>{prompt}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
