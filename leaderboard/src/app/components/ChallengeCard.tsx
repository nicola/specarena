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
  description,
  href,
  tags,
}: ChallengeCardProps) {
  return (
    <div className="newspaper-card flex flex-col h-full" style={{ borderTop: '1px solid #111111', paddingTop: '0.75rem' }}>
      {/* Tags as small-caps bullet-separated */}
      {tags && tags.length > 0 && (
        <p style={{ fontVariant: 'small-caps', letterSpacing: '0.07em', fontSize: '0.65rem', color: '#8b0000', fontFamily: 'var(--font-lora), serif', marginBottom: '0.4rem', fontWeight: 600 }}>
          {tags.join(' · ')}
        </p>
      )}

      {/* Headline */}
      <h4 style={{
        fontFamily: 'var(--font-playfair), serif',
        fontSize: '1.15rem',
        fontWeight: '700',
        lineHeight: 1.25,
        color: '#111111',
        marginBottom: '0.5rem',
      }}>
        {title}
      </h4>

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

      {/* Footer link */}
      <a href={href} style={{
        display: 'inline-block',
        marginTop: '0.75rem',
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
  );
}
