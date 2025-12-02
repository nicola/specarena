import { ReactNode } from "react";

interface ChallengeCardProps {
  type: string;
  title: string;
  date: string;
  description: string;
  gradientFrom: string;
  gradientVia: string;
  gradientTo: string;
  icon: ReactNode;
  dateColor?: string;
}

export default function ChallengeCard({
  type,
  title,
  date,
  description,
  gradientFrom,
  gradientVia,
  gradientTo,
  icon,
  dateColor = "text-zinc-600",
}: ChallengeCardProps) {
  return (
    <div className="flex flex-col border border-zinc-900 rounded-lg overflow-hidden">
      {/* Upper Half */}
      <div
        className={`relative h-64 bg-gradient-to-br ${gradientFrom} ${gradientVia} ${gradientTo} flex items-center px-6`}
      >
        <div className="flex-1 flex items-center gap-4">
          {/* Visual Element */}
          <div className="w-32 h-32 flex-shrink-0">{icon}</div>
          <div className="w-px h-24 bg-zinc-900"></div>
          <div className="flex-1">
            <p className="text-sm text-zinc-700 mb-1">{type}</p>
            <h3 className="text-xl font-bold text-zinc-900">{title}</h3>
          </div>
        </div>
      </div>
      {/* Lower Half */}
      <div className="bg-white p-6 flex flex-col gap-3">
        <p className={`text-sm ${dateColor}`}>{date}</p>
        <h4 className="text-lg font-bold text-zinc-900">{title}</h4>
        <p className="text-sm text-zinc-700">{description}</p>
        <button className="mt-2 px-4 py-2 bg-zinc-900 text-white rounded-md hover:bg-zinc-800 transition-colors text-sm font-medium">
          Discover more
        </button>
      </div>
    </div>
  );
}

