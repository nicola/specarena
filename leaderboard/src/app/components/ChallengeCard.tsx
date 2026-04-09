"use client";

import { ReactNode } from "react";
import { tagColors, tagStyles } from "@/lib/tagColors";

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
  accentColor = '#ff006e',
}: ChallengeCardProps) {
  return (
    <div
      className="challenge-card flex flex-col overflow-hidden h-full relative"
      style={{
        background: '#160428',
        border: `1px solid ${accentColor}`,
        boxShadow: `4px 4px 0 #8338ec, 0 0 15px ${accentColor}22`,
        transition: 'box-shadow 0.2s, transform 0.2s',
        // CSS custom property for accent
        ['--accent' as string]: accentColor,
      }}
    >
      <style>{`
        .challenge-card:hover {
          box-shadow: 6px 6px 0 #00d4ff, 0 0 25px var(--accent, #ff006e)44 !important;
          transform: translate(-2px, -2px);
        }
        .challenge-enter-btn:hover {
          background: var(--btn-accent, #ff006e) !important;
          color: #1a0533 !important;
          box-shadow: 0 0 16px var(--btn-accent, #ff006e)88 !important;
        }
      `}</style>

      {/* Top accent bar */}
      <div style={{ height: '2px', background: `linear-gradient(90deg, ${accentColor}, #8338ec, #00d4ff)` }} />

      {/* Upper Half - Icon area */}
      <div
        className="relative h-44 flex items-center justify-center flex-shrink-0 overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #1f0547 0%, #2d0a5e 50%, #1a0533 100%)',
        }}
      >
        {/* Grid background in card */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `linear-gradient(${accentColor}18 1px, transparent 1px), linear-gradient(90deg, ${accentColor}18 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }} />
        {/* Icon */}
        <div className="relative z-10 w-28 h-28 float">
          {icon}
        </div>
        {/* Corner accents */}
        <div className="absolute top-2 left-2 w-4 h-4 border-t border-l" style={{ borderColor: accentColor }} />
        <div className="absolute top-2 right-2 w-4 h-4 border-t border-r" style={{ borderColor: '#00d4ff' }} />
        <div className="absolute bottom-2 left-2 w-4 h-4 border-b border-l" style={{ borderColor: '#00d4ff' }} />
        <div className="absolute bottom-2 right-2 w-4 h-4 border-b border-r" style={{ borderColor: accentColor }} />

        {tags && tags.length > 0 && (
          <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5 z-10">
            {tags.map((tag) => {
              const colorClass = tagColors[tag] || tagColors._default;
              const style = tagStyles[tag] || tagStyles._default;
              return (
                <span
                  key={tag}
                  className={colorClass}
                  style={{
                    ...style,
                    fontFamily: 'var(--font-orbitron), sans-serif',
                    fontSize: '0.55rem',
                    letterSpacing: '0.05em',
                  }}
                >
                  {tag}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Lower Half */}
      <div
        className="p-5 flex flex-col gap-3 flex-1 min-h-0"
        style={{ background: 'rgba(22, 4, 40, 0.9)' }}
      >
        <div className="flex flex-col gap-2">
          {date && (
            <p
              className="text-xs"
              style={{
                color: accentColor,
                fontFamily: 'var(--font-orbitron), sans-serif',
                letterSpacing: '0.1em',
              }}
            >
              {date}
            </p>
          )}
          <h4
            className="text-base font-bold"
            style={{
              fontFamily: 'var(--font-orbitron), sans-serif',
              color: '#f0e6ff',
              letterSpacing: '0.03em',
            }}
          >
            {title}
          </h4>
          <p className="text-xs leading-relaxed" style={{ color: '#9d7ab8' }}>
            {description}
          </p>
        </div>
        <a
          href={href}
          className="challenge-enter-btn mt-auto text-center py-2 px-4 text-xs transition-all duration-200"
          style={{
            fontFamily: 'var(--font-orbitron), sans-serif',
            letterSpacing: '0.08em',
            border: `1px solid ${accentColor}`,
            color: accentColor,
            background: 'transparent',
            boxShadow: `0 0 8px ${accentColor}33`,
            ['--btn-accent' as string]: accentColor,
          }}
        >
          ENTER CHALLENGE ▶
        </a>
      </div>
    </div>
  );
}
