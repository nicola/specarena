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
    <div
      className="flex flex-col h-full"
      style={{
        background: '#ffffff',
        border: '1px solid var(--border-warm)',
        borderLeft: '3px solid var(--accent-blue)',
        overflow: 'hidden',
      }}
    >
      {/* Icon area — muted academic palette, no gradient */}
      <div
        className="relative flex-shrink-0"
        style={{
          height: '140px',
          background: '#f0ede4',
          borderBottom: '1px solid var(--border-warm)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
        }}
      >
        <div className="w-full h-full flex-shrink-0" style={{ color: 'var(--accent-blue)', opacity: 0.7 }}>
          {icon}
        </div>

        {tags && tags.length > 0 && (
          <div className="absolute bottom-2 left-3 flex flex-wrap gap-1">
            {tags.map((tag) => {
              const colors = tagColors[tag] || tagColors._default;
              return (
                <span
                  key={tag}
                  className={`${colors}`}
                  style={{
                    fontSize: '10px',
                    padding: '1px 6px',
                    borderRadius: '2px',
                    fontFamily: 'var(--font-sans)',
                    letterSpacing: '0.03em',
                  }}
                >
                  {tag}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Content area */}
      <div className="flex flex-col gap-2 flex-1 min-h-0" style={{ padding: '18px 20px 20px' }}>
        {date && (
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--muted-text)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            {date}
          </p>
        )}
        <h4
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '18px',
            fontWeight: 600,
            color: 'var(--foreground)',
            lineHeight: 1.3,
            margin: 0,
          }}
        >
          {title}
        </h4>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: '#4a4535', lineHeight: 1.6, margin: 0 }}>
          {description}
        </p>
        <a
          href={href}
          className="mt-auto"
          style={{
            display: 'inline-block',
            marginTop: '16px',
            fontFamily: 'var(--font-sans)',
            fontSize: '12px',
            fontWeight: 500,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: 'var(--accent-blue)',
            borderBottom: '1px solid var(--accent-blue)',
            paddingBottom: '1px',
            textDecoration: 'none',
          }}
        >
          View challenge →
        </a>
      </div>
    </div>
  );
}
