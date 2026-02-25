"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { type ChatMessage, deduplicateMessages, getConversationKey } from "@/lib/chat-utils";

interface Score {
  security: number;
  utility: number;
}

interface GameEndedData {
  scores: Score[];
  players: string[];
  playerIdentities: Record<string, string>;
}

interface SSEMessageData {
  type: 'initial' | 'new_message' | 'game_ended';
  messages?: ChatMessage[];
  message?: ChatMessage;
  scores?: Score[];
  players?: string[];
  playerIdentities?: Record<string, string>;
}

interface ConversationsListProps {
  uuid: string;
  engineUrl?: string;
}

// Generate a color based on a string (for consistent avatar colors)
const getAvatarColor = (name: string): string => {
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

// Get initials from a name
const getInitials = (name: string): string => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

const CHALLENGE_CHANNEL_PREFIX = "challenge_";
const toChallengeChannel = (id: string) => `${CHALLENGE_CHANNEL_PREFIX}${id}`;

// Map raw channel names to friendly display labels
const getChannelDisplayName = (channel: string, uuid: string): string => {
  if (channel === toChallengeChannel(uuid)) return "Arena";
  if (channel === uuid) return "Chat";
  return channel;
};

export default function ConversationsList({ uuid, engineUrl = "" }: ConversationsListProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameEnded, setGameEnded] = useState<GameEndedData | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const challengeEventSourceRef = useRef<EventSource | null>(null);
  const initialLoadCountRef = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleMessage = useCallback((data: SSEMessageData) => {
    if (data.type === 'initial') {
      // Initial load of all messages
      setMessages((prev) => {
        const newMessages = deduplicateMessages(prev, data.messages || []);
        const merged = [...prev, ...newMessages];
        merged.sort((a, b) => a.timestamp - b.timestamp);
        return merged;
      });
      
      initialLoadCountRef.current += 1;
      if (initialLoadCountRef.current >= 2) {
        setLoading(false);
        setError(null);
        setTimeout(scrollToBottom, 100);
      }
    } else if (data.type === 'game_ended' && data.scores) {
      setGameEnded({ scores: data.scores, players: data.players || [], playerIdentities: data.playerIdentities || {} });
    } else if (data.type === 'new_message' && data.message) {
      // New message received
      setMessages((prev) => {
        const unique = deduplicateMessages(prev, [data.message!]);
        if (unique.length === 0) return prev;
        const merged = [...prev, ...unique];
        merged.sort((a, b) => a.timestamp - b.timestamp);
        setTimeout(scrollToBottom, 100);
        return merged;
      });
    }
  }, []);

  const connectSSE = useCallback((url: string, onMessage: (data: SSEMessageData) => void): EventSource => {
    const es = new EventSource(url);
    es.onmessage = (event) => {
      try {
        onMessage(JSON.parse(event.data));
      } catch (err) {
        console.error('Error parsing SSE message:', err);
      }
    };
    es.onerror = () => {
      setError("Connection error. Attempting to reconnect...");
    };
    es.onopen = () => {
      setError(null);
    };
    return es;
  }, []);

  const connectWebSocket = useCallback(() => {
    // Reset initial load counter
    initialLoadCountRef.current = 0;

    // Close existing connections if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    if (challengeEventSourceRef.current) {
      challengeEventSourceRef.current.close();
    }

    const base = engineUrl;
    eventSourceRef.current = connectSSE(`${base}/api/chat/ws/${uuid}`, handleMessage);
    challengeEventSourceRef.current = connectSSE(`${base}/api/chat/ws/${toChallengeChannel(uuid)}`, handleMessage);
  }, [uuid, engineUrl, handleMessage, connectSSE]);

  useEffect(() => {
    // Initialize loading state and connect to both EventSource streams
    // Note: Setting loading state synchronously here is necessary for connection initialization
    // This is a valid pattern when setting up external connections
    setLoading(true);
    connectWebSocket();

    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (challengeEventSourceRef.current) {
        challengeEventSourceRef.current.close();
        challengeEventSourceRef.current = null;
      }
    };
  }, [connectWebSocket]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleRefresh = () => {
    setLoading(true);
    connectWebSocket();
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Sort messages chronologically
  const sortedMessages = [...messages].sort((a, b) => a.timestamp - b.timestamp);

  // Build a map from invite codes to "Player N" display names (order of first appearance)
  const playerMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const msg of sortedMessages) {
      if (msg.from !== "operator" && !map.has(msg.from)) {
        map.set(msg.from, `Player ${map.size + 1}`);
      }
    }
    return map;
  }, [sortedMessages]);

  const displayName = (name: string): string => {
    if (name === "operator") return "Operator";
    return playerMap.get(name) ?? name;
  };

  if (loading && messages.length === 0) {
    return (
      <div className="p-8 text-center text-zinc-500">
        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-zinc-400 mb-2"></div>
        <p>Loading conversations...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-600 bg-red-50 rounded-lg border border-red-200">
        <p className="font-medium">Connection Error</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="p-8 text-center text-zinc-500">
        <div className="text-4xl mb-2">💬</div>
        <p>No conversations yet.</p>
        <p className="text-sm mt-1">Messages will appear here when agents start chatting.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-zinc-200 mb-4">
        <div>
          <h3 className="text-xl font-semibold text-zinc-900">Conversations</h3>
          <p className="text-xs text-zinc-400 mt-1">
            Viewing as observer — private messages between agents are redacted.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {gameEnded ? (
            <span className="text-xs text-zinc-500 flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 bg-zinc-500 rounded-full"></span>
              Game ended
            </span>
          ) : (
            <span className="text-xs text-green-600 flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              Live
            </span>
          )}
          <button
            onClick={handleRefresh}
            className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors px-2 py-1 rounded hover:bg-zinc-100"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto space-y-6 pr-2">
        {sortedMessages.map((message, idx) => {
          const prevMessage = idx > 0 ? sortedMessages[idx - 1] : null;
          const currentConversation = getConversationKey(message);
          const prevConversation = prevMessage ? getConversationKey(prevMessage) : null;
          const conversationChanged = currentConversation !== prevConversation;
          
          // Show sender if it's the first message, conversation changed, or sender changed within same conversation
          const showSender = idx === 0 || 
            conversationChanged || 
            (prevMessage && prevMessage.from !== message.from);
          
          const isDirectMessage = message.to !== null;
          const isPrivateMessage = message.to === "operator" || (message.from === "operator" && message.to !== null);
          
          return (
            <div key={`${message.channel}-${message.index}`}>
              {/* Conversation Header - show when conversation changes */}
              {conversationChanged && (() => {
                const channelName = getChannelDisplayName(currentConversation, uuid);
                const isArena = currentConversation === toChallengeChannel(uuid);
                const isChat = currentConversation === uuid;
                return (
                  <div className="sticky top-0 bg-white/95 backdrop-blur-sm py-2 z-10 mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`h-px flex-1 ${isArena ? 'bg-amber-200' : 'bg-zinc-200'}`}></div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        isArena
                          ? 'bg-amber-100 text-amber-700'
                          : isChat
                            ? 'bg-zinc-100 text-zinc-500'
                            : 'text-zinc-500'
                      }`}>
                        {message.to
                          ? <><span title={message.from}>{displayName(message.from)}</span>{" → "}<span title={message.to}>{displayName(message.to)}</span></>
                          : channelName
                        }
                      </span>
                      <div className={`h-px flex-1 ${isArena ? 'bg-amber-200' : 'bg-zinc-200'}`}></div>
                    </div>
                  </div>
                );
              })()}
              
              {/* Message */}
              <div className={`flex gap-3 group ${showSender ? 'mt-4' : 'mt-1'}`}>
                {/* Avatar */}
                {showSender ? (
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full ${getAvatarColor(message.from)} flex items-center justify-center text-white text-xs font-semibold`} title={message.from}>
                    {getInitials(displayName(message.from))}
                  </div>
                ) : (
                  <div className="w-8"></div>
                )}

                {/* Message Content */}
                <div className="flex-1 min-w-0">
                  {showSender && (
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="font-semibold text-sm text-zinc-900 cursor-default" title={message.from}>
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
                  <div className={`inline-block max-w-[85%] rounded-2xl px-4 py-2.5 ${
                    message.redacted
                      ? 'border border-dashed border-zinc-300 bg-transparent text-zinc-400'
                      : isPrivateMessage
                        ? 'bg-zinc-400 text-zinc-100'
                        : showSender
                          ? 'bg-zinc-100 text-zinc-900'
                          : 'bg-zinc-100 text-zinc-800'
                  }`}>
                    {message.redacted ? (
                      <p className="text-sm italic text-zinc-400">
                        🔒 Private message
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
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Scores Panel */}
      {gameEnded && (
        <div className="mt-6 pt-4 border-t border-zinc-200">
          <h4 className="text-sm font-semibold text-zinc-900 mb-3">Final Scores</h4>
          <div className="grid gap-2">
            {gameEnded.scores.map((score, i) => {
              const rawName = gameEnded.players[i] || `Player ${i + 1}`;
              const label = displayName(rawName);
              const identity = gameEnded.playerIdentities[rawName];
              return (
                <div key={i} className="flex items-center gap-3 bg-zinc-50 rounded-lg px-4 py-2.5">
                  <div className={`flex-shrink-0 w-7 h-7 rounded-full ${getAvatarColor(rawName)} flex items-center justify-center text-white text-xs font-semibold`} title={rawName}>
                    {getInitials(label)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-zinc-800 block truncate cursor-default" title={rawName}>
                      {label}
                    </span>
                    {identity && (
                      <span className="text-xs font-mono text-zinc-400 block truncate cursor-default" title={identity}>
                        {identity.slice(0, 8)}...{identity.slice(-8)}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-4 text-sm">
                    <span className="text-zinc-600">
                      Security: <span className="font-semibold text-zinc-900">{score.security}</span>
                    </span>
                    <span className="text-zinc-600">
                      Utility: <span className="font-semibold text-zinc-900">{score.utility}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

