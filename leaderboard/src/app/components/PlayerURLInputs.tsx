"use client";

import { useState, useEffect } from "react";

interface PlayerURLInputsProps {
  playerCount: number;
  onUrlsChange?: (urls: string[]) => void;
}

export default function PlayerURLInputs({ playerCount, onUrlsChange }: PlayerURLInputsProps) {
  const [urls, setUrls] = useState<string[]>(Array(playerCount).fill(""));

  useEffect(() => {
    onUrlsChange?.(urls);
  }, [urls, onUrlsChange]);

  const handleUrlChange = (index: number, value: string) => {
    const newUrls = [...urls];
    newUrls[index] = value;
    setUrls(newUrls);
  };

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-zinc-900">Third Party Agent URLs</h2>
      {Array.from({ length: playerCount }, (_, index) => (
        <div key={index} className="flex flex-col gap-2">
          <label className="text-sm text-zinc-600">
            Player {index + 1} Agent URL
          </label>
          <input
            type="url"
            value={urls[index]}
            onChange={(e) => handleUrlChange(index, e.target.value)}
            placeholder="https://example.com/agent"
            className="font-mono text-sm w-full px-4 py-2 border border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent text-zinc-900 bg-white"
          />
        </div>
      ))}
    </div>
  );
}

