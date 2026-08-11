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
  accentColor?: string;
}

export default function ChallengeCard({
  title,
  date,
  description,
  icon,
  href,
  tags,
  accentColor = "#00ffff",
}: ChallengeCardProps) {
  // Convert hex to rgb components for dynamic rgba usage in CSS vars
  const hex = accentColor.replace('#', '');
  const r = parseInt(hex.substring(0,2), 16);
  const g = parseInt(hex.substring(2,4), 16);
  const b = parseInt(hex.substring(4,6), 16);

  return (
    <div
      className="neon-challenge-card flex flex-col overflow-hidden h-full"
      style={{
        '--accent': accentColor,
        '--accent-r': r,
        '--accent-g': g,
        '--accent-b': b,
        background: '#0d0d0d',
        border: `1px solid ${accentColor}`,
        boxShadow: `0 0 8px rgba(${r},${g},${b},0.25), inset 0 0 20px rgba(0,0,0,0.5)`,
        transition: 'box-shadow 0.25s ease, transform 0.25s ease',
        position: 'relative',
      } as React.CSSProperties}
    >
      <style>{`
        .neon-challenge-card:hover {
          box-shadow: 0 0 20px ${accentColor}, 0 0 40px rgba(${r},${g},${b},0.4), inset 0 0 30px rgba(0,0,0,0.8) !important;
          transform: translateY(-2px) !important;
        }
        .neon-challenge-card .neon-enter-btn:hover {
          background: rgba(${r},${g},${b},0.12) !important;
          box-shadow: 0 0 15px ${accentColor}, 0 0 30px rgba(${r},${g},${b},0.3) !important;
          text-shadow: 0 0 8px ${accentColor} !important;
        }
      `}</style>

      {/* Corner decorations */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '12px', height: '12px', borderTop: `2px solid ${accentColor}`, borderLeft: `2px solid ${accentColor}`, zIndex: 10 }} />
      <div style={{ position: 'absolute', top: 0, right: 0, width: '12px', height: '12px', borderTop: `2px solid ${accentColor}`, borderRight: `2px solid ${accentColor}`, zIndex: 10 }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, width: '12px', height: '12px', borderBottom: `2px solid ${accentColor}`, borderLeft: `2px solid ${accentColor}`, zIndex: 10 }} />
      <div style={{ position: 'absolute', bottom: 0, right: 0, width: '12px', height: '12px', borderBottom: `2px solid ${accentColor}`, borderRight: `2px solid ${accentColor}`, zIndex: 10 }} />

      {/* Icon area */}
      <div
        className="relative flex-shrink-0 flex items-center justify-center"
        style={{
          height: '180px',
          background: `radial-gradient(ellipse at center, rgba(${r},${g},${b},0.08) 0%, transparent 70%)`,
          borderBottom: `1px solid ${accentColor}`,
          overflow: 'hidden',
        }}
      >
        {/* Grid lines */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `linear-gradient(rgba(${r},${g},${b},0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(${r},${g},${b},0.06) 1px, transparent 1px)`,
          backgroundSize: '20px 20px',
        }} />

        <div className="w-24 h-24 relative z-10" style={{ color: accentColor, filter: `drop-shadow(0 0 8px ${accentColor})` }}>
          {icon}
        </div>

        {/* Tags overlay */}
        {tags && tags.length > 0 && (
          <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5 z-10">
            {tags.map((tag) => {
              const colors = tagColors[tag] || tagColors._default;
              return (
                <span
                  key={tag}
                  className={colors}
                  style={{ fontSize: '0.6rem', letterSpacing: '0.1em' }}
                >
                  {tag}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Content area */}
      <div className="p-5 flex flex-col gap-3 flex-1 min-h-0" style={{ background: '#0d0d0d' }}>
        {date && (
          <p className="text-xs" style={{ color: accentColor, opacity: 0.7, fontFamily: 'inherit', letterSpacing: '0.05em' }}>
            // {date}
          </p>
        )}
        <h4
          className="text-base font-bold tracking-wide"
          style={{
            fontFamily: 'var(--font-orbitron), monospace',
            color: '#ffffff',
            textShadow: `0 0 6px ${accentColor}`,
            lineHeight: 1.3,
          }}
        >
          {title}
        </h4>
        <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)', fontFamily: 'inherit', lineHeight: 1.6 }}>
          {description}
        </p>

        <a
          href={href}
          className="neon-enter-btn mt-auto text-center text-xs tracking-widest uppercase py-2 px-4"
          style={{
            border: `1px solid ${accentColor}`,
            color: accentColor,
            fontFamily: 'inherit',
            background: 'transparent',
            transition: 'all 0.2s ease',
            display: 'block',
          }}
        >
          &gt; Enter Arena
        </a>
      </div>
    </div>
  );
}
