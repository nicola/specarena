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
  description,
  icon,
  href,
  tags,
}: ChallengeCardProps) {
  return (
    <div className="flex flex-col border border-black overflow-hidden h-full">
      {/* Upper Half — monochrome, no gradient */}
      <div className="relative h-48 bg-[#f5f5f5] flex items-center px-6 flex-shrink-0">
        <div className="flex-1 flex items-center gap-4">
          <div className="w-full h-32 flex-shrink-0 text-black">{icon}</div>
        </div>
        {tags && tags.length > 0 && (
          <div className="absolute bottom-3 left-4 flex flex-wrap gap-1.5">
            {tags.map((tag) => {
              const colors = tagColors[tag] || tagColors._default;
              return (
                <span key={tag} className={`text-xs px-2 py-0.5 ${colors}`}>
                  {tag}
                </span>
              );
            })}
          </div>
        )}
      </div>
      {/* Lower Half */}
      <div className="bg-white p-6 flex flex-col gap-3 flex-1 min-h-0 border-t border-black">
        <div className="flex flex-col gap-3">
          <h4 className="text-lg font-black text-black" style={{ fontFamily: 'var(--font-jost), sans-serif' }}>{title}</h4>
          <p className="text-sm text-[#333]">{description}</p>
        </div>
        <a
          href={href}
          className="mt-auto px-4 py-2 bg-black text-white text-sm text-center font-bold hover:bg-white hover:text-black border border-black transition-colors"
        >
          Discover more
        </a>
      </div>
    </div>
  );
}
