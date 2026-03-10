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

const TERMINAL_STYLE = {
  fontFamily: "'VT323', 'Courier New', Courier, monospace",
} as const;

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
      ...TERMINAL_STYLE,
      display: 'flex',
      flexDirection: 'column',
      border: '1px solid #00ff00',
      background: '#000000',
      height: '100%',
    }}>
      {/* Top section - ASCII art area */}
      <div style={{
        position: 'relative',
        height: '192px',
        background: '#000000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        borderBottom: '1px solid #00ff00',
        padding: '16px',
      }}>
        {/* Icon rendered in green */}
        <div style={{
          width: '100%',
          height: '128px',
          flexShrink: 0,
          filter: 'invert(1) sepia(1) saturate(5) hue-rotate(90deg)',
          opacity: 0.8,
        }}>
          {icon}
        </div>
        {tags && tags.length > 0 && (
          <div style={{
            position: 'absolute',
            bottom: '8px',
            left: '8px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px',
          }}>
            {tags.map((tag) => {
              return (
                <span key={tag} style={{
                  ...TERMINAL_STYLE,
                  fontSize: '12px',
                  padding: '1px 6px',
                  border: '1px solid #008800',
                  color: '#008800',
                  background: '#000000',
                }}>
                  [{tag}]
                </span>
              );
            })}
          </div>
        )}
      </div>
      {/* Lower section */}
      <div style={{
        background: '#000000',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        flex: 1,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {date && <p style={{ ...TERMINAL_STYLE, fontSize: '13px', color: '#008800', margin: 0 }}>{date}</p>}
          <h4 style={{ ...TERMINAL_STYLE, fontSize: '20px', color: '#ffffff', margin: 0 }}>
            &gt; {title}
          </h4>
          <p style={{ ...TERMINAL_STYLE, fontSize: '16px', color: '#00cc00', margin: 0, lineHeight: '1.3' }}>{description}</p>
        </div>
        <a
          href={href}
          style={{
            ...TERMINAL_STYLE,
            marginTop: 'auto',
            padding: '6px 12px',
            border: '1px solid #00ff00',
            color: '#00ff00',
            fontSize: '18px',
            textAlign: 'center',
            display: 'block',
            textDecoration: 'none',
            background: '#000000',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = '#00ff00';
            (e.currentTarget as HTMLElement).style.color = '#000000';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = '#000000';
            (e.currentTarget as HTMLElement).style.color = '#00ff00';
          }}
        >
          [ ENTER ]
        </a>
      </div>
    </div>
  );
}
