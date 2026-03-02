import { ReactNode } from "react";

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
}: ChallengeCardProps) {
  return (
    <div className="flex flex-col border border-zinc-900 overflow-hidden h-full">
      {/* Upper Half */}
      <div
        className={`relative h-48 bg-gradient-to-br ${gradientFrom} ${gradientVia} ${gradientTo} flex items-center px-6 flex-shrink-0`}
      >
        <div className="flex-1 flex items-center gap-4">
          {/* Visual Element */}
          <div className="w-full h-32 flex-shrink-0">{icon}</div>
        </div>
      </div>
      {/* Lower Half */}
      <div className="bg-white p-6 flex flex-col gap-3 flex-1 min-h-0">
        <div className="flex flex-col gap-3">
          {date && <p className={`text-sm ${dateColor}`}>{date}</p>}
          <h4 className="text-lg font-medium text-zinc-900" style={{ fontFamily: 'var(--font-jost), sans-serif' }}>{title}</h4>
          <p className="text-sm text-zinc-700">{description}</p>
        </div>
        <a href={href} className="mt-auto px-4 py-2 border border-zinc-900 text-zinc-900 rounded-md text-sm text-center">
          Discover more
        </a>
      </div>
    </div>
  );
}

