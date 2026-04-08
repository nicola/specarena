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
      className="flex flex-col overflow-hidden h-full"
      style={{
        background: '#faf6ef',
        border: '1px solid #d4c4a8',
        boxShadow: 'inset 0 1px 3px rgba(26,16,8,0.06)',
      }}
    >
      {/* Upper Half — ink wash illustration area */}
      <div
        className="relative flex items-center px-6 flex-shrink-0"
        style={{
          height: '12rem',
          background: 'linear-gradient(135deg, #f0e8d8 0%, #e8dcc8 50%, #f0e8d8 100%)',
          borderBottom: '1px solid #d4c4a8',
        }}
      >
        {/* Decorative corner marks — like ink painting border */}
        <span style={{ position: 'absolute', top: 8, left: 8, width: 12, height: 12, borderTop: '1.5px solid #cc2200', borderLeft: '1.5px solid #cc2200', opacity: 0.6 }} />
        <span style={{ position: 'absolute', top: 8, right: 8, width: 12, height: 12, borderTop: '1.5px solid #cc2200', borderRight: '1.5px solid #cc2200', opacity: 0.6 }} />
        <span style={{ position: 'absolute', bottom: 8, left: 8, width: 12, height: 12, borderBottom: '1.5px solid #cc2200', borderLeft: '1.5px solid #cc2200', opacity: 0.6 }} />
        <span style={{ position: 'absolute', bottom: 8, right: 8, width: 12, height: 12, borderBottom: '1.5px solid #cc2200', borderRight: '1.5px solid #cc2200', opacity: 0.6 }} />

        <div className="flex-1 flex items-center gap-4">
          <div className="w-full h-32 flex-shrink-0" style={{ opacity: 0.75 }}>{icon}</div>
        </div>
        {tags && tags.length > 0 && (
          <div className="absolute bottom-3 left-4 flex flex-wrap gap-1.5">
            {tags.map((tag) => {
              const colors = tagColors[tag] || tagColors._default;
              return (
                <span key={tag} className={`text-xs px-2 py-0.5 ${colors}`} style={{ borderRadius: 0, fontFamily: 'var(--font-noto-sans)' }}>
                  {tag}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Lower Half — parchment content */}
      <div className="p-6 flex flex-col gap-3 flex-1 min-h-0" style={{ background: '#faf6ef' }}>
        <div className="flex flex-col gap-3">
          {date && (
            <p
              className="text-sm"
              style={{ color: '#8b4513', fontFamily: 'var(--font-noto-sans)', letterSpacing: '0.04em' }}
            >
              {date}
            </p>
          )}
          {/* Red brush-stroke accent above title */}
          <div style={{ width: 32, height: 2, background: '#cc2200', opacity: 0.7, marginBottom: 2 }} />
          <h4
            className="text-lg font-semibold"
            style={{
              fontFamily: 'var(--font-noto-serif), serif',
              color: '#1a1008',
              letterSpacing: '0.02em',
            }}
          >
            {title}
          </h4>
          <p className="text-sm" style={{ color: '#5a4030', lineHeight: 1.6 }}>{description}</p>
        </div>
        <a
          href={href}
          className="mt-auto text-sm text-center ink-btn-vermillion"
          style={{
            display: 'block',
            padding: '8px 16px',
            border: '1px solid #cc2200',
            color: '#cc2200',
            fontFamily: 'var(--font-noto-sans)',
            letterSpacing: '0.06em',
            textDecoration: 'none',
            background: 'transparent',
            transition: 'background 0.15s, color 0.15s',
          }}
        >
          Discover more →
        </a>
      </div>
    </div>
  );
}
