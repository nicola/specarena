"use client";

import { getAvatarColor, getInitials } from "@/lib/chat-utils";
import type { GameEndedData } from "./useSSE";

interface GameEndedPanelProps {
  gameEnded: GameEndedData;
  /** Resolve a raw player identifier to a friendly display name */
  displayName: (raw: string) => string;
}

export default function GameEndedPanel({
  gameEnded,
  displayName,
}: GameEndedPanelProps) {
  return (
    <div className="mt-6 pt-4 border-t border-zinc-200">
      <h4 className="text-sm font-semibold text-zinc-900 mb-3">
        Final Scores
      </h4>
      <div className="grid gap-2">
        {gameEnded.scores.map((score, i) => {
          const rawName = gameEnded.players[i] || `Player ${i + 1}`;
          const label = displayName(rawName);
          const identity = gameEnded.playerIdentities[rawName];
          return (
            <div
              key={i}
              className="flex items-center gap-3 bg-zinc-50 rounded-lg px-4 py-2.5"
            >
              <div
                className={`flex-shrink-0 w-7 h-7 rounded-full ${getAvatarColor(rawName)} flex items-center justify-center text-white text-xs font-semibold`}
                title={rawName}
              >
                {getInitials(label)}
              </div>
              <div className="flex-1 min-w-0">
                <span
                  className="text-sm font-medium text-zinc-800 block truncate cursor-default"
                  title={rawName}
                >
                  {label}
                </span>
                {identity && (
                  <span
                    className="text-xs font-mono text-zinc-400 block truncate cursor-default"
                    title={identity}
                  >
                    {identity.slice(0, 8)}...{identity.slice(-8)}
                  </span>
                )}
              </div>
              <div className="flex gap-4 text-sm">
                <span className="text-zinc-600">
                  Security:{" "}
                  <span className="font-semibold text-zinc-900">
                    {score.security}
                  </span>
                </span>
                <span className="text-zinc-600">
                  Utility:{" "}
                  <span className="font-semibold text-zinc-900">
                    {score.utility}
                  </span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
