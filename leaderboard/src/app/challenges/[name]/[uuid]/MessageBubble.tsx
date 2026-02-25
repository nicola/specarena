"use client";

import {
  getAvatarColor,
  getInitials,
  getChannelDisplayName,
  toChallengeChannel,
  formatTimestamp,
} from "@/lib/chat-utils";
import type { ChatMessage } from "./useSSE";

interface MessageBubbleProps {
  message: ChatMessage;
  uuid: string;
  /** Whether to render the conversation-change divider above this message */
  conversationChanged: boolean;
  /** Conversation key for this message (channel or "from -> to") */
  conversationKey: string;
  /** Whether to show the sender avatar / name row */
  showSender: boolean;
  /** Human-friendly display name resolver */
  displayName: (raw: string) => string;
}

export default function MessageBubble({
  message,
  uuid,
  conversationChanged,
  conversationKey,
  showSender,
  displayName,
}: MessageBubbleProps) {
  const isDirectMessage = message.to !== null;
  const isPrivateMessage =
    message.to === "operator" ||
    (message.from === "operator" && message.to !== null);

  return (
    <div>
      {/* Conversation Header - show when conversation changes */}
      {conversationChanged &&
        (() => {
          const channelName = getChannelDisplayName(conversationKey, uuid);
          const isArena = conversationKey === toChallengeChannel(uuid);
          const isChat = conversationKey === uuid;
          return (
            <div className="sticky top-0 bg-white/95 backdrop-blur-sm py-2 z-10 mb-2">
              <div className="flex items-center gap-2">
                <div
                  className={`h-px flex-1 ${isArena ? "bg-amber-200" : "bg-zinc-200"}`}
                ></div>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    isArena
                      ? "bg-amber-100 text-amber-700"
                      : isChat
                        ? "bg-zinc-100 text-zinc-500"
                        : "text-zinc-500"
                  }`}
                >
                  {message.to ? (
                    <>
                      <span title={message.from}>
                        {displayName(message.from)}
                      </span>
                      {" \u2192 "}
                      <span title={message.to}>
                        {displayName(message.to)}
                      </span>
                    </>
                  ) : (
                    channelName
                  )}
                </span>
                <div
                  className={`h-px flex-1 ${isArena ? "bg-amber-200" : "bg-zinc-200"}`}
                ></div>
              </div>
            </div>
          );
        })()}

      {/* Message */}
      <div className={`flex gap-3 group ${showSender ? "mt-4" : "mt-1"}`}>
        {/* Avatar */}
        {showSender ? (
          <div
            className={`flex-shrink-0 w-8 h-8 rounded-full ${getAvatarColor(message.from)} flex items-center justify-center text-white text-xs font-semibold`}
            title={message.from}
          >
            {getInitials(displayName(message.from))}
          </div>
        ) : (
          <div className="w-8"></div>
        )}

        {/* Message Content */}
        <div className="flex-1 min-w-0">
          {showSender && (
            <div className="flex items-baseline gap-2 mb-1">
              <span
                className="font-semibold text-sm text-zinc-900 cursor-default"
                title={message.from}
              >
                {displayName(message.from)}
              </span>
              {!isDirectMessage && (
                <span className="text-xs text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded">
                  Broadcast
                </span>
              )}
              <span className="text-xs text-zinc-400 ml-auto">
                {formatTimestamp(message.timestamp)}
              </span>
            </div>
          )}

          {/* Chat Bubble */}
          <div
            className={`inline-block max-w-[85%] rounded-2xl px-4 py-2.5 ${
              message.redacted
                ? "border border-dashed border-zinc-300 bg-transparent text-zinc-400"
                : isPrivateMessage
                  ? "bg-zinc-400 text-zinc-100"
                  : showSender
                    ? "bg-zinc-100 text-zinc-900"
                    : "bg-zinc-100 text-zinc-800"
            }`}
          >
            {message.redacted ? (
              <p className="text-sm italic text-zinc-400">
                {"🔒 Private message"}
              </p>
            ) : (
              <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                {message.content}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
