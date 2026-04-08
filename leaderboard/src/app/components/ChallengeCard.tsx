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
  dateColor = "text-white/50",
  href,
  tags,
}: ChallengeCardProps) {
  return (
    <div
      className="flex flex-col glass rounded-xl overflow-hidden h-full transition-all duration-300 glow-purple-hover"
      style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}
    >
      {/* Upper Half — icon/gradient area */}
      <div
        className={`relative h-48 bg-gradient-to-br ${gradientFrom} ${gradientVia} ${gradientTo} flex items-center px-6 flex-shrink-0`}
        style={{ background: 'linear-gradient(135deg, rgba(102,126,234,0.25) 0%, rgba(118,75,162,0.2) 100%)' }}
      >
        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />
        <div className="flex-1 flex items-center gap-4 relative z-10">
          <div className="w-full h-32 flex-shrink-0 text-white/80">{icon}</div>
        </div>
        {tags && tags.length > 0 && (
          <div className="absolute bottom-3 left-4 flex flex-wrap gap-1.5 z-10">
            {tags.map((tag) => {
              const colors = tagColors[tag] || tagColors._default;
              return (
                <span key={tag} className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${colors}`}>
                  {tag}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Lower Half */}
      <div
        className="p-6 flex flex-col gap-3 flex-1 min-h-0"
        style={{ background: 'rgba(255,255,255,0.03)' }}
      >
        <div className="flex flex-col gap-2">
          {date && <p className={`text-xs font-medium uppercase tracking-wider ${dateColor}`}>{date}</p>}
          <h4
            className="text-base font-semibold text-white"
            style={{ fontFamily: 'var(--font-jost), sans-serif' }}
          >
            {title}
          </h4>
          <p className="text-sm text-white/55 leading-relaxed">{description}</p>
        </div>
        <a
          href={href}
          className="mt-auto gradient-btn text-center text-sm font-medium px-4 py-2 rounded-lg"
        >
          Discover more
        </a>
      </div>
    </div>
  );
}
