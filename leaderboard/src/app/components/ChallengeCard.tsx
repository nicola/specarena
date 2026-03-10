import { ReactNode } from "react";

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
      border: '1px solid #ffb000',
      overflow: 'hidden',
      height: '100%',
      background: '#0d0a00',
    }}>
      {/* Upper Half — icon area */}
      <div style={{
        position: 'relative',
        height: '12rem',
        background: '#0f0c00',
        display: 'flex',
        alignItems: 'center',
        padding: '1.5rem',
        flexShrink: 0,
        borderBottom: '1px solid #ffb000',
      }}>
        <div style={{ width: '100%', height: '8rem', flexShrink: 0, color: '#ffb000', opacity: 0.7 }}>
          {icon}
        </div>
        {tags && tags.length > 0 && (
          <div style={{
            position: 'absolute',
            bottom: '0.75rem',
            left: '1rem',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.375rem',
          }}>
            {tags.map((tag) => (
              <span key={tag} style={{
                fontFamily: '"Courier New", monospace',
                fontSize: '0.65rem',
                padding: '0.1rem 0.4rem',
                border: '1px solid #cc8800',
                color: '#cc8800',
                textShadow: '0 0 4px #cc8800',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Lower Half */}
      <div style={{
        background: '#0d0a00',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        flex: 1,
        minHeight: 0,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {date && (
            <p style={{
              fontFamily: '"Courier New", monospace',
              fontSize: '0.75rem',
              color: '#cc8800',
              textShadow: '0 0 4px #cc8800',
              margin: 0,
            }}>{date}</p>
          )}
          <h4 style={{
            fontFamily: '"Courier New", monospace',
            fontSize: '1rem',
            fontWeight: 'bold',
            color: '#ffcc44',
            textShadow: '0 0 8px #ffcc44',
            margin: 0,
            letterSpacing: '0.03em',
          }}>{title}</h4>
          <p style={{
            fontFamily: '"Courier New", monospace',
            fontSize: '0.78rem',
            color: '#ffb000',
            textShadow: '0 0 6px #ffb000',
            margin: 0,
            lineHeight: 1.5,
          }}>{description}</p>
        </div>
        <a href={href} style={{
          marginTop: 'auto',
          padding: '0.4rem 1rem',
          border: '1px solid #ffb000',
          color: '#ffb000',
          fontFamily: '"Courier New", monospace',
          fontSize: '0.75rem',
          textAlign: 'center',
          textDecoration: 'none',
          textShadow: '0 0 6px #ffb000',
          letterSpacing: '0.08em',
          display: 'block',
          transition: 'background 0.1s, color 0.1s',
        }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = '#ffb000';
            (e.currentTarget as HTMLElement).style.color = '#0d0a00';
            (e.currentTarget as HTMLElement).style.textShadow = 'none';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.color = '#ffb000';
            (e.currentTarget as HTMLElement).style.textShadow = '0 0 6px #ffb000';
          }}
        >
          [DISCOVER MORE]
        </a>
      </div>
    </div>
  );
}
