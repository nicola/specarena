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

export default function ChallengeCard({
  title,
  description,
  href,
  tags,
  author,
  sessions,
  category,
}: ChallengeCardProps) {
  // Separate category-like tags (e.g. "cryptography") from player count tags
  const playerTag = tags?.find(t => t.includes('-player')) ?? null;
  const categoryTag = category ?? tags?.find(t => !t.includes('-player')) ?? null;

  // Build the top kicker line: CATEGORY · N-PLAYER
  const kickerParts: string[] = [];
  if (categoryTag) kickerParts.push(categoryTag.toUpperCase());
  if (playerTag) kickerParts.push(playerTag.toUpperCase());
  const kicker = kickerParts.join(' · ');

  // Byline
  const bylineParts: string[] = [];
  if (author) bylineParts.push(`By ${author}`);
  bylineParts.push('Est. March 2026');
  if (sessions != null) bylineParts.push(`${sessions} Sessions`);
  const byline = bylineParts.join('  ·  ');

  return (
    <div className="newspaper-card flex flex-col h-full" style={{ borderTop: '1px solid #111111', paddingTop: '0.75rem' }}>

      {/* Kicker: CATEGORY · N-PLAYER */}
      {kicker && (
        <p style={{
          fontVariant: 'small-caps',
          letterSpacing: '0.08em',
          fontSize: '0.62rem',
          color: '#8b0000',
          fontFamily: 'var(--font-lora), serif',
          fontWeight: 600,
          marginBottom: '0.5rem',
        }}>
          {kicker}
        </p>
      )}

      {/* Headline */}
      <h4 style={{
        fontFamily: 'var(--font-playfair), serif',
        fontSize: '1.2rem',
        fontWeight: '700',
        lineHeight: 1.2,
        color: '#111111',
        marginBottom: '0.5rem',
      }}>
        {title}
      </h4>

      {/* Rule below headline */}
      <div style={{ borderBottom: '1px solid #aaa', marginBottom: '0.5rem' }} />

      {/* Byline */}
      <p style={{
        fontFamily: 'var(--font-lora), serif',
        fontSize: '0.68rem',
        fontStyle: 'italic',
        color: '#8b0000',
        marginBottom: '0.6rem',
        lineHeight: 1.4,
      }}>
        {byline}
      </p>

      {/* Rule below byline */}
      <div style={{ borderBottom: '1px solid #ddd', marginBottom: '0.6rem' }} />

      {/* Body copy */}
      <p style={{
        fontFamily: 'var(--font-lora), serif',
        fontSize: '0.82rem',
        lineHeight: 1.6,
        color: '#333333',
        flexGrow: 1,
      }}>
        {description}
      </p>

      {/* Footer: right-aligned "Read More →" */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
        <a href={href} style={{
          fontVariant: 'small-caps',
          letterSpacing: '0.08em',
          fontSize: '0.68rem',
          color: '#8b0000',
          fontFamily: 'var(--font-lora), serif',
          fontWeight: 600,
          textDecoration: 'none',
          borderBottom: '1px solid #8b0000',
          paddingBottom: '1px',
        }}>
          Read More →
        </a>
      </div>
    </div>
  );
}
