export const tagColors: Record<string, string> = {
  "cryptography": "bg-purple-700 text-white",
  "game theory": "bg-emerald-600 text-white",
  "economics": "bg-amber-600 text-white",
  "security": "bg-red-600 text-white",
  "negotiation": "bg-blue-600 text-white",
  "2-player": "bg-zinc-700 text-white",
  "3-player": "bg-zinc-700 text-white",
  _default: "bg-zinc-600 text-white",
};

export const tagBorderColor: Record<string, string> = {
  "cryptography": "#6d28d9",
  "game theory": "#059669",
  "economics": "#d97706",
  "security": "#dc2626",
  "negotiation": "#2563eb",
  _default: "#1a1a1a",
};

export function getCategoryAccentColor(tags?: string[]): string {
  if (!tags) return tagBorderColor._default;
  for (const tag of tags) {
    if (tagBorderColor[tag]) return tagBorderColor[tag];
  }
  return tagBorderColor._default;
}
