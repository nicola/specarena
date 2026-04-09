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
  date,
  description,
  icon,
  href,
  tags,
}: ChallengeCardProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      background: '#ffffff',
      border: '1px solid #e8e8e8',
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      borderRadius: 2,
      overflow: 'hidden',
      height: '100%',
      transition: 'box-shadow 0.2s, border-color 0.2s',
    }}
    onMouseEnter={e => {
      const el = e.currentTarget as HTMLDivElement;
      el.style.boxShadow = '0 4px 16px rgba(229,57,53,0.12)';
      el.style.borderColor = '#e53935';
    }}
    onMouseLeave={e => {
      const el = e.currentTarget as HTMLDivElement;
      el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
      el.style.borderColor = '#e8e8e8';
    }}
    >
      {/* Icon area — clean white with red accent bar */}
      <div style={{
        position: 'relative',
        height: 140,
        background: '#fafafa',
        borderBottom: '1px solid #e8e8e8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px 24px',
      }}>
        {/* Top red accent bar */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: 'linear-gradient(90deg, #e53935, #ff6b35)',
        }} />
        <div style={{ width: 80, height: 80, opacity: 0.7 }}>
          {icon}
        </div>
        {tags && tags.length > 0 && (
          <div style={{
            position: 'absolute',
            bottom: 10,
            left: 12,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
          }}>
            {tags.map((tag) => {
              const colors = tagColors[tag] || tagColors._default;
              return (
                <span key={tag} className={`text-xs px-2 py-0.5 rounded-sm ${colors}`}
                  style={{ fontSize: 10, fontWeight: 500 }}>
                  {tag}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Content area */}
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        {date && (
          <p style={{ fontSize: 11, color: '#aaaaaa', margin: 0 }}>{date}</p>
        )}
        <h4 style={{
          fontSize: 15,
          fontWeight: 600,
          color: '#333333',
          margin: 0,
          fontFamily: '-apple-system, "PingFang SC", sans-serif',
        }}>
          {title}
        </h4>
        <p style={{ fontSize: 12, color: '#666666', margin: 0, lineHeight: 1.6, flex: 1 }}>
          {description}
        </p>
        <a
          href={href}
          style={{
            display: 'block',
            marginTop: 12,
            padding: '8px 0',
            background: '#e53935',
            color: '#ffffff',
            textAlign: 'center',
            fontSize: 12,
            fontWeight: 500,
            textDecoration: 'none',
            borderRadius: 2,
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#c62828')}
          onMouseLeave={e => (e.currentTarget.style.background = '#e53935')}
        >
          查看详情 / Discover more
        </a>
      </div>
    </div>
  );
}
