import { ReactNode } from "react";
import { tagColors, tagBorderColor } from "@/lib/tagColors";

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
  gradientFrom,
  gradientVia,
  gradientTo,
  icon,
  dateColor = "text-zinc-600",
  href,
  tags,
  accentColor,
}: ChallengeCardProps) {
  const borderAccent = accentColor || '#1a1a1a';
  return (
    <div
      className="flex flex-col overflow-hidden h-full transition-all duration-200 group"
      style={{
        border: `1px solid #e5e0d8`,
        borderLeft: `4px solid ${borderAccent}`,
        background: '#ffffff',
      }}
    >
      {/* Upper Half */}
      <div
        className={`relative h-48 bg-gradient-to-br ${gradientFrom} ${gradientVia} ${gradientTo} flex items-center px-6 flex-shrink-0`}
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
                <span key={tag} className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors}`}>
                  {tag}
                </span>
              );
            })}
          </div>
        )}
      </div>
      {/* Lower Half */}
      <div className="bg-white p-6 flex flex-col gap-3 flex-1 min-h-0">
        <div className="flex flex-col gap-3">
          {date && <p className={`text-sm ${dateColor}`}>{date}</p>}
          <h4
            className="text-lg font-medium transition-colors duration-200"
            style={{ fontFamily: 'var(--font-jost), sans-serif', color: '#1a1a1a' }}
          >{title}</h4>
          <p className="text-sm text-zinc-600">{description}</p>
        </div>
        <a
          href={href}
          className="mt-auto px-4 py-2 rounded-md text-sm text-center font-medium text-white transition-all duration-200"
          style={{ background: borderAccent }}
        >
          Discover more
        </a>
      </div>
    </div>
  );
}
