// EASTERN MINIMAL: tags use a colored dot prefix, no background fill
// The value here is the dot color class used in tag rendering
export const tagDotColors: Record<string, string> = {
  "cryptography": "#9333ea",
  "game theory": "#059669",
  "economics": "#d97706",
  "security": "#cc0000",
  "negotiation": "#2563eb",
  "2-player": "#aaaaaa",
  "3-player": "#aaaaaa",
  _default: "#aaaaaa",
};

// Legacy: kept for compatibility with files that import tagColors
export const tagColors: Record<string, string> = {
  "cryptography": "text-purple-700",
  "game theory": "text-emerald-700",
  "economics": "text-amber-700",
  "security": "text-red-700",
  "negotiation": "text-blue-700",
  "2-player": "text-zinc-500",
  "3-player": "text-zinc-500",
  _default: "text-zinc-600",
};
