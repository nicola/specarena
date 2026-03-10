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
  gradientFrom,
  gradientVia,
  gradientTo,
  icon,
  href,
  tags,
}: ChallengeCardProps) {
  return (
    <div className="flex flex-col overflow-hidden h-full" style={{ border: '1px solid #dee2e6', background: '#fff' }}>
      {/* Icon area — compact */}
      <div
        className={`relative h-28 bg-gradient-to-br ${gradientFrom} ${gradientVia} ${gradientTo} flex items-center px-4 flex-shrink-0`}
      >
        <div className="w-full h-20 flex-shrink-0">{icon}</div>
        {tags && tags.length > 0 && (
          <div className="absolute bottom-2 left-3 flex flex-wrap gap-1">
            {tags.map((tag) => {
              const colors = tagColors[tag] || tagColors._default;
              return (
                <span key={tag} className={`px-1.5 py-0 rounded font-medium ${colors}`} style={{ fontSize: '11px' }}>
                  {tag}
                </span>
              );
            })}
          </div>
        )}
      </div>
      {/* Content area — tight */}
      <div className="px-3 py-2 flex flex-col gap-1.5 flex-1 min-h-0" style={{ background: '#fff' }}>
        <h4 className="font-semibold leading-tight" style={{ color: '#212529', fontSize: '13px' }}>{title}</h4>
        <p className="leading-snug flex-1" style={{ color: '#6c757d', fontSize: '12px' }}>{description}</p>
        <a href={href} className="mt-1 px-2 py-1 text-center rounded font-medium transition-colors hover:opacity-90" style={{ border: '1px solid #0d6efd', color: '#0d6efd', fontSize: '12px', textDecoration: 'none' }}>
          View challenge
        </a>
      </div>
    </div>
  );
}
