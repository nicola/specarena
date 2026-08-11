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
  dateColor = "text-zinc-500",
  href,
  tags,
}: ChallengeCardProps) {
  return (
    <div className="group flex flex-col border border-zinc-200 overflow-hidden h-full rounded-sm shadow-sm hover:shadow-md hover:border-zinc-300 hover:-translate-y-0.5 transition-all duration-200">
      {/* Upper Half */}
      <div
        className={`relative h-48 bg-gradient-to-br ${gradientFrom} ${gradientVia} ${gradientTo} flex items-center px-6 flex-shrink-0`}
      >
        <div className="flex-1 flex items-center gap-4">
          {/* Visual Element */}
          <div className="w-full h-32 flex-shrink-0 opacity-80 group-hover:opacity-100 transition-opacity duration-200">{icon}</div>
        </div>
        {tags && tags.length > 0 && (
          <div className="absolute bottom-3 left-4 flex flex-wrap gap-1.5">
            {tags.map((tag) => {
              const colors = tagColors[tag] || tagColors._default;
              return (
                <span key={tag} className={`text-[11px] font-medium tracking-wide px-2.5 py-1 rounded-full uppercase ${colors}`}>
                  {tag}
                </span>
              );
            })}
          </div>
        )}
      </div>
      {/* Lower Half */}
      <div className="bg-white p-6 flex flex-col gap-3 flex-1 min-h-0">
        <div className="flex flex-col gap-2">
          {date && <p className={`text-xs font-medium uppercase tracking-wider ${dateColor}`}>{date}</p>}
          <h4
            className="text-base font-semibold text-zinc-900 leading-snug"
            style={{ fontFamily: 'var(--font-jost), sans-serif', letterSpacing: '-0.01em' }}
          >
            {title}
          </h4>
          <p className="text-sm text-zinc-500 leading-relaxed">{description}</p>
        </div>
        <a
          href={href}
          className="mt-auto px-4 py-2 border border-zinc-200 text-zinc-700 rounded-sm text-sm text-center font-medium hover:bg-zinc-900 hover:text-white hover:border-zinc-900 transition-all duration-200"
        >
          Start Challenge →
        </a>
      </div>
    </div>
  );
}
