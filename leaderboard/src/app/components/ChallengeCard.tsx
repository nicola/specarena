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
  gradientFrom,
  gradientVia,
  gradientTo,
  icon,
  dateColor = "text-zinc-600",
  href,
  tags,
}: ChallengeCardProps) {
  return (
    <div
      className="flex flex-col overflow-hidden h-full"
      style={{
        borderRadius: '12px',
        boxShadow: 'var(--elevation-1)',
        background: 'var(--surface)',
        border: '1px solid var(--outline-variant)',
      }}
    >
      {/* Upper Half */}
      <div
        className={`relative h-48 bg-gradient-to-br ${gradientFrom} ${gradientVia} ${gradientTo} flex items-center px-6 flex-shrink-0`}
        style={{ borderRadius: '12px 12px 0 0' }}
      >
        <div className="flex-1 flex items-center gap-4">
          {/* Visual Element */}
          <div className="w-full h-32 flex-shrink-0">{icon}</div>
        </div>
        {tags && tags.length > 0 && (
          <div className="absolute bottom-3 left-4 flex flex-wrap gap-1.5">
            {tags.map((tag) => {
              const colors = tagColors[tag] || tagColors._default;
              return (
                <span
                  key={tag}
                  className={`text-xs px-2.5 py-0.5 font-medium ${colors}`}
                  style={{ borderRadius: '8px' }}
                >
                  {tag}
                </span>
              );
            })}
          </div>
        )}
      </div>
      {/* Lower Half */}
      <div className="p-5 flex flex-col gap-3 flex-1 min-h-0" style={{ background: 'var(--surface)' }}>
        <div className="flex flex-col gap-2">
          {date && <p className={`text-xs font-medium ${dateColor}`} style={{ color: 'var(--on-surface-variant)' }}>{date}</p>}
          <h4 className="text-base font-medium" style={{ color: 'var(--on-surface)', fontFamily: 'var(--font-google-sans), Roboto, sans-serif' }}>{title}</h4>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--on-surface-variant)' }}>{description}</p>
        </div>
        <a
          href={href}
          className="mat-discover-btn mt-auto text-sm font-medium text-center"
          style={{
            color: 'var(--primary)',
            border: '1px solid var(--primary)',
            borderRadius: '20px',
            padding: '8px 20px',
            display: 'block',
          }}
        >
          Discover more
        </a>
      </div>
    </div>
  );
}
