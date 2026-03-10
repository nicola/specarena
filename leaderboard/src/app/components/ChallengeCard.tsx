import { ReactNode } from "react";
import { tagColors } from "@/lib/tagColors";

interface ChallengeCardProps {
  title: string;
  date: string;
  description: string;
  gradientFrom: string;
  gradientVia: string;
  gradientTo: string;
  icon: ReactNode;
  dateColor?: string;
  href: string;
  tags?: string[];
}

export default function ChallengeCard({
  title,
  description,
  icon,
  href,
  tags,
}: ChallengeCardProps) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      border: "2px solid #000000",
      background: "#ffffff",
      height: "100%",
    }}>
      {/* Visual area — black background with red accent */}
      <div style={{
        position: "relative",
        height: "160px",
        background: "#000000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        overflow: "hidden",
      }}>
        {/* Grid lines decoration */}
        <div style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "linear-gradient(rgba(227,6,19,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(227,6,19,0.15) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }} />
        {/* Icon container */}
        <div style={{
          width: "80px",
          height: "80px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          filter: "invert(1)",
          position: "relative",
          zIndex: 1,
        }}>
          {icon}
        </div>
        {/* Tags */}
        {tags && tags.length > 0 && (
          <div style={{
            position: "absolute",
            bottom: "8px",
            left: "8px",
            display: "flex",
            flexWrap: "wrap",
            gap: "4px",
          }}>
            {tags.map((tag) => (
              <span key={tag} className="swiss-tag" style={{
                fontSize: "9px",
                padding: "2px 6px",
              }}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Content area */}
      <div style={{
        background: "#ffffff",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        flex: 1,
        borderTop: "4px solid #e30613",
      }}>
        <h4 style={{
          fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
          fontSize: "15px",
          fontWeight: 700,
          color: "#000000",
          margin: 0,
          lineHeight: 1.2,
        }}>{title}</h4>
        <p style={{
          fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
          fontSize: "12px",
          color: "#767676",
          margin: 0,
          lineHeight: 1.5,
          flex: 1,
        }}>{description}</p>
        <a href={href} className="swiss-btn" style={{
          marginTop: "8px",
          textAlign: "center",
          display: "block",
        }}>
          View Challenge
        </a>
      </div>
    </div>
  );
}
