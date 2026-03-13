"use client";

import { useState } from "react";
import LeaderboardGraph from "./LeaderboardGraph";

interface LeaderboardEntry {
  name: string;
  securityPolicy: number;
  utility: number;
  model?: string;
  isBenchmark?: boolean;
}

type FilterMode = "all" | "human" | "benchmark";

interface LeaderboardSectionProps {
  data: LeaderboardEntry[];
}

export default function LeaderboardSection({ data }: LeaderboardSectionProps) {
  const [filter, setFilter] = useState<FilterMode>("all");

  const filteredData =
    filter === "human"
      ? data.filter((d) => !d.isBenchmark)
      : filter === "benchmark"
        ? data.filter((d) => d.isBenchmark)
        : data;

  const tabs: { id: FilterMode; label: string }[] = [
    { id: "all", label: "All" },
    { id: "human", label: "Human" },
    { id: "benchmark", label: "Benchmark" },
  ];

  return (
    <div className="max-w-4xl mx-auto border border-zinc-900 p-8">
      {/* Filter tabs */}
      <div className="flex gap-1 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={
              "px-3 py-1 text-sm rounded-md border transition-colors " +
              (filter === tab.id
                ? "bg-zinc-900 text-white border-zinc-900"
                : "bg-white text-zinc-700 border-zinc-300 hover:border-zinc-900 hover:text-zinc-900")
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      <LeaderboardGraph data={filteredData.length > 0 ? filteredData : undefined} />
    </div>
  );
}
