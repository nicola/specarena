// Shared chat utility functions

export const CHALLENGE_CHANNEL_PREFIX = "challenge_";

export const toChallengeChannel = (id: string) =>
  `${CHALLENGE_CHANNEL_PREFIX}${id}`;

/** Map raw channel names to friendly display labels */
export const getChannelDisplayName = (
  channel: string,
  uuid: string,
): string => {
  if (channel === toChallengeChannel(uuid)) return "Arena";
  if (channel === uuid) return "Chat";
  return channel;
};

/** Generate a deterministic Tailwind color class from a string */
export const getAvatarColor = (name: string): string => {
  const colors = [
    "bg-blue-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-indigo-500",
    "bg-teal-500",
    "bg-orange-500",
    "bg-green-500",
    "bg-red-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

/** Get up to two uppercase initials from a display name */
export const getInitials = (name: string): string => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

/** Human-friendly relative timestamp */
export const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};
