import { ReactNode } from "react";
import { tagDotColors } from "@/lib/tagColors";

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
    <div className="flex flex-col overflow-hidden h-full" style={{ border: '1px solid #eeeeee' }}>
      {/* Upper Half — clean white with subtle icon */}
      <div className="relative h-44 bg-white flex items-center justify-center px-8 flex-shrink-0" style={{ borderBottom: '1px solid #eeeeee' }}>
        <div className="w-24 h-24 flex-shrink-0 opacity-20">{icon}</div>
        {tags && tags.length > 0 && (
          <div className="absolute bottom-3 left-5 flex flex-wrap gap-3">
            {tags.map((tag) => {
              const dotColor = tagDotColors[tag] || tagDotColors._default;
              return (
                <span key={tag} className="text-xs flex items-center gap-1" style={{ color: '#aaaaaa' }}>
                  <span style={{ color: dotColor, fontSize: '8px' }}>●</span>
                  {tag}
                </span>
              );
            })}
          </div>
        )}
      </div>
      {/* Lower Half */}
      <div className="bg-white px-6 py-6 flex flex-col gap-4 flex-1 min-h-0">
        <div className="flex flex-col gap-2">
          {date && <p className="text-xs" style={{ color: '#aaaaaa' }}>{date}</p>}
          <h4 className="text-sm font-medium" style={{ color: '#1a1a1a', fontWeight: 500 }}>{title}</h4>
          <p className="text-xs leading-relaxed" style={{ color: '#aaaaaa' }}>{description}</p>
        </div>
        <a
          href={href}
          className="mt-auto text-xs text-center py-2 px-4 transition-colors"
          style={{
            border: '1px solid #cc0000',
            color: '#cc0000',
            display: 'block',
          }}
        >
          Discover more
        </a>
      </div>
    </div>
  );
}
