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
  author?: string;
  sessions?: number;
  category?: string;
}

const WIRE_CODES = ["ARENA", "MAS", "AP-AI"];

export default function ChallengeCard({
  title,
  description,
  href,
  tags,
  author,
  sessions,
  category,
}: ChallengeCardProps) {
  const playerTag = tags?.find(t => t.includes('-player')) ?? null;
  const categoryTag = category ?? tags?.find(t => !t.includes('-player')) ?? null;

  // Pick a deterministic wire code based on title
  const wc = WIRE_CODES[title.charCodeAt(0) % WIRE_CODES.length];

  const isBreaking = sessions === 0;
  const isDeveloping = sessions != null && sessions > 0 && sessions < 10;

  return (
    <div style={{
      borderTop: '2px solid #111',
      paddingTop: '0.75rem',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    }}>
      {/* Wire meta row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.55rem',
          fontWeight: 600,
          color: '#cc0000',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}>
          {wc}
        </span>
        <span style={{ color: '#ddd', fontSize: '0.5rem' }}>|</span>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.5rem',
          color: '#888',
          letterSpacing: '0.04em',
        }}>
          {new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase()}
        </span>
        <div style={{ marginLeft: 'auto' }}>
          {isBreaking ? (
            <span style={{
              background: '#cc0000', color: '#fff',
              fontFamily: 'var(--font-mono)', fontSize: '0.48rem', fontWeight: 600,
              letterSpacing: '0.1em', padding: '0.1em 0.35em', textTransform: 'uppercase',
            }}>BREAKING</span>
          ) : isDeveloping ? (
            <span style={{
              background: '#111', color: '#fff',
              fontFamily: 'var(--font-mono)', fontSize: '0.48rem', fontWeight: 600,
              letterSpacing: '0.1em', padding: '0.1em 0.35em', textTransform: 'uppercase',
            }}>DEVELOPING</span>
          ) : (
            <span style={{
              border: '1px solid #aaa', color: '#888',
              fontFamily: 'var(--font-mono)', fontSize: '0.48rem', fontWeight: 600,
              letterSpacing: '0.1em', padding: '0.1em 0.35em', textTransform: 'uppercase',
            }}>CLOSED</span>
          )}
        </div>
      </div>

      {/* Category tag */}
      {categoryTag && (
        <p style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.5rem',
          color: '#888',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginBottom: '0.3rem',
        }}>
          {categoryTag}{playerTag && ` · ${playerTag}`}
        </p>
      )}

      {/* Headline */}
      <h4 style={{
        fontFamily: 'var(--font-playfair), serif',
        fontSize: '1.15rem',
        fontWeight: '700',
        lineHeight: 1.2,
        color: '#111111',
        marginBottom: '0.4rem',
      }}>
        {title}
      </h4>

      <div style={{ borderBottom: '1px solid #e8e4dc', marginBottom: '0.4rem' }} />

      {/* Byline */}
      {author && (
        <p style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.52rem',
          color: '#888',
          letterSpacing: '0.04em',
          marginBottom: '0.4rem',
        }}>
          BY {author.toUpperCase()}{sessions != null && ` — ${sessions} SESSIONS`}
        </p>
      )}

      {/* Lede */}
      <p style={{
        fontFamily: 'var(--font-body)',
        fontSize: '0.82rem',
        lineHeight: 1.6,
        color: '#333333',
        flexGrow: 1,
      }}>
        {description}
      </p>

      {/* Read more */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
        <a href={href} style={{
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.1em',
          fontSize: '0.58rem',
          color: '#cc0000',
          fontWeight: 600,
          textDecoration: 'none',
          borderBottom: '1px solid #cc0000',
          paddingBottom: '1px',
          textTransform: 'uppercase',
        }}>
          READ DISPATCH →
        </a>
      </div>
    </div>
  );
}
