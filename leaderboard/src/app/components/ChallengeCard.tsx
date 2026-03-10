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
    <div className="flex flex-col border border-zinc-900 overflow-hidden h-full">
      {/* Upper Half — taller, more dramatic gradient area */}
      <div
        className={`relative h-56 bg-gradient-to-br ${gradientFrom} ${gradientVia} ${gradientTo} flex items-center px-8 flex-shrink-0`}
      >
        <div className="flex-1 flex items-center gap-4">
          {/* Visual Element */}
          <div className="w-full h-36 flex-shrink-0">{icon}</div>
        </div>
        {tags && tags.length > 0 && (
          <div className="absolute bottom-4 left-4 flex flex-wrap gap-1.5">
            {tags.map((tag) => {
              const colors = tagColors[tag] || tagColors._default;
              return (
                <span
                  key={tag}
                  className={`text-[10px] px-2 py-0.5 font-bold tracking-widest uppercase ${colors}`}
                  style={{ borderRadius: 0 }}
                >
                  {tag}
                </span>
              );
            })}
          </div>
        )}
      </div>
      {/* Lower Half */}
      <div className="bg-white px-7 py-6 flex flex-col gap-4 flex-1 min-h-0">
        <div className="flex flex-col gap-2">
          {date && (
            <p className={`text-[10px] font-bold tracking-widest uppercase ${dateColor}`}>
              {date}
            </p>
          )}
          <h4
            className="text-2xl font-black text-zinc-900 leading-tight tracking-tight"
            style={{ fontFamily: 'var(--font-jost), sans-serif' }}
          >
            {title}
          </h4>
          <p className="text-sm text-zinc-500 leading-relaxed">{description}</p>
        </div>
        <a
          href={href}
          className="mt-auto inline-block px-4 py-2.5 border border-zinc-900 text-zinc-900 text-xs font-bold tracking-widest uppercase text-center hover:bg-zinc-900 hover:text-white transition-colors"
        >
          Discover more
        </a>
      </div>
    </div>
  );
}
