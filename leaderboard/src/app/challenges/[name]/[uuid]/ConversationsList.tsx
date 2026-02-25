"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useSSE } from "./useSSE";
import type { ChatMessage, GameEndedData, SSEMessageData } from "./useSSE";
import MessageBubble from "./MessageBubble";
import GameEndedPanel from "./GameEndedPanel";

interface ConversationsListProps {
  uuid: string;
  engineUrl?: string;
}

export default function ConversationsList({ uuid, engineUrl = "" }: ConversationsListProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [gameEnded, setGameEnded] = useState<GameEndedData | null>(null);
  const initialLoadCountRef = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleMessage = useCallback((data: SSEMessageData) => {
    if (data.type === 'initial') {
      // Initial load of all messages
      setMessages((prev) => {
        // Merge with existing messages, avoiding duplicates
        const existingChannels = new Set(prev.map(msg => `${msg.channel}-${msg.index}`));
        const newMessages = (data.messages || []).filter(
          (msg: ChatMessage): msg is ChatMessage =>
            msg !== undefined && !existingChannels.has(`${msg.channel}-${msg.index}`)
        );
        const merged = [...prev, ...newMessages];
        // Sort by timestamp
        merged.sort((a, b) => a.timestamp - b.timestamp);
        return merged;
      });

      initialLoadCountRef.current += 1;
      if (initialLoadCountRef.current >= 2) {
        setLoading(false);
        setTimeout(scrollToBottom, 100);
      }
    } else if (data.type === 'game_ended' && data.scores) {
      setGameEnded({ scores: data.scores, players: data.players || [], playerIdentities: data.playerIdentities || {} });
    } else if (data.type === 'new_message' && data.message) {
      // New message received
      setMessages((prev) => {
        // Check if message already exists (avoid duplicates)
        const exists = prev.some(
          (msg) => msg.channel === data.message!.channel && msg.index === data.message!.index
        );
        if (exists) {
          return prev;
        }
        const newMessages = [...prev, data.message!];
        // Sort by timestamp
        newMessages.sort((a, b) => a.timestamp - b.timestamp);
        setTimeout(scrollToBottom, 100);
        return newMessages;
      });
    }
  }, []);

  const { error, reconnect } = useSSE(uuid, engineUrl, handleMessage);

  // Reset initial load counter and loading state on reconnect
  const handleRefresh = () => {
    initialLoadCountRef.current = 0;
    setLoading(true);
    reconnect();
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

  // Helper to get conversation key for a message
  const getConversationKey = (message: ChatMessage): string => {
    if (!!message.to) {
      return `${message.from} -> ${message.to}`;
    }
    return message.channel;
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
            (prevMessage !== null && prevMessage.from !== message.from);

          return (
            <MessageBubble
              key={`${message.channel}-${message.index}`}
              message={message}
              uuid={uuid}
              conversationChanged={conversationChanged}
              conversationKey={currentConversation}
              showSender={showSender}
              displayName={displayName}
            />
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Scores Panel */}
      {gameEnded && (
        <GameEndedPanel gameEnded={gameEnded} displayName={displayName} />
      )}
    </div>
  );
}
