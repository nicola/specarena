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
  rank?: number;
}

export default function ChallengeCard({
  title,
  description,
  href,
  tags,
  rank,
}: ChallengeCardProps) {
  return (
    <div style={{ borderTop: '3px solid #111111', paddingTop: '1rem', display: 'flex', flexDirection: 'column', height: '100%', transition: 'border-color 0.2s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#8b0000'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#111111'; }}>

      {/* Rank number behind the card */}
      {rank !== undefined && (
        <div style={{
          fontFamily: 'var(--font-playfair), serif',
          fontWeight: 900,
          fontSize: '3rem',
          color: '#e8e4dc',
          lineHeight: 1,
          letterSpacing: '-0.04em',
          marginBottom: '-0.5rem',
          userSelect: 'none',
        }}>
          {String(rank).padStart(2, '0')}
        </div>
      )}

      {/* Tags / category dateline */}
      {tags && tags.length > 0 && (
        <p style={{
          fontVariant: 'small-caps',
          letterSpacing: '0.1em',
          fontSize: '0.62rem',
          color: '#8b0000',
          fontFamily: 'var(--font-lora), serif',
          fontWeight: 700,
          marginBottom: '0.4rem',
        }}>
          {tags.join(' · ')}
        </p>
      )}

      {/* Headline */}
      <h4 style={{
        fontFamily: 'var(--font-playfair), serif',
        fontSize: '1.15rem',
        fontWeight: 700,
        lineHeight: 1.2,
        color: '#111111',
        marginBottom: '0.5rem',
        letterSpacing: '-0.01em',
      }}>
        {title}
      </h4>

      {/* Body copy */}
      <p style={{
        fontFamily: 'var(--font-lora), serif',
        fontSize: '0.82rem',
        lineHeight: 1.6,
        color: '#444444',
        flexGrow: 1,
      }}>
        {description}
      </p>

      {/* Read more link */}
      <a href={href} style={{
        display: 'inline-block',
        marginTop: '0.75rem',
        fontVariant: 'small-caps',
        letterSpacing: '0.08em',
        fontSize: '0.65rem',
        color: '#8b0000',
        fontFamily: 'var(--font-lora), serif',
        fontWeight: 700,
        textDecoration: 'none',
        borderBottom: '1px solid #8b0000',
        paddingBottom: '1px',
      }}>
        Read Story →
      </a>
    </div>
  );
}
