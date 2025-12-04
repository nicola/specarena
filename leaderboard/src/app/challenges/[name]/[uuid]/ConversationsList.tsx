"use client";

import { useEffect, useState, useRef, useCallback } from "react";

interface ChatMessage {
  channel: string;
  from: string;
  to: string | null;
  content: string;
  index: number;
  timestamp: number;
}

interface SSEMessageData {
  type: 'initial' | 'new_message';
  messages?: ChatMessage[];
  message?: ChatMessage;
}

interface ConversationsListProps {
  uuid: string;
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

export default function ConversationsList({ uuid }: ConversationsListProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
        setError(null);
        setTimeout(scrollToBottom, 100);
      }
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

    // Create first EventSource connection for regular uuid
    const eventSource = new EventSource(`/api/chat/ws/${uuid}`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleMessage(data);
      } catch (err) {
        console.error('Error parsing SSE message:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('EventSource error:', err);
      setError("Connection error. Attempting to reconnect...");
      // EventSource will automatically attempt to reconnect
    };

    eventSource.onopen = () => {
      setError(null);
    };

    // Create second EventSource connection for challenge_uuid
    const challengeEventSource = new EventSource(`/api/chat/ws/challenge_${uuid}`);
    challengeEventSourceRef.current = challengeEventSource;

    challengeEventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleMessage(data);
      } catch (err) {
        console.error('Error parsing challenge SSE message:', err);
      }
    };

    challengeEventSource.onerror = (err) => {
      console.error('Challenge EventSource error:', err);
      setError("Connection error. Attempting to reconnect...");
      // EventSource will automatically attempt to reconnect
    };

    challengeEventSource.onopen = () => {
      setError(null);
    };
  }, [uuid, handleMessage]);

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
  
  // Helper to get conversation key for a message
  const getConversationKey = (message: ChatMessage): string => {
    if (message.to !== null) {
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
        <h3 className="text-xl font-semibold text-zinc-900">Conversations</h3>
        <div className="flex items-center gap-3">
          <span className="text-xs text-green-600 flex items-center gap-1.5 font-medium">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            Live
          </span>
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
              {conversationChanged && (
                <div className="sticky top-0 bg-white/95 backdrop-blur-sm py-2 z-10 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-zinc-200"></div>
                    <span className="text-xs font-medium text-zinc-500 px-2">
                      {currentConversation}
                    </span>
                    <div className="h-px flex-1 bg-zinc-200"></div>
                  </div>
                </div>
              )}
              
              {/* Message */}
              <div className={`flex gap-3 group ${showSender ? 'mt-4' : 'mt-1'}`}>
                {/* Avatar */}
                {showSender ? (
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full ${getAvatarColor(message.from)} flex items-center justify-center text-white text-xs font-semibold`}>
                    {getInitials(message.from)}
                  </div>
                ) : (
                  <div className="w-8"></div>
                )}

                {/* Message Content */}
                <div className="flex-1 min-w-0">
                  {showSender && (
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="font-semibold text-sm text-zinc-900">
                        {message.from}
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
                    isPrivateMessage
                      ? showSender 
                        ? 'bg-zinc-400 text-zinc-100' 
                        : 'bg-zinc-400 text-zinc-100'
                      : showSender 
                        ? 'bg-zinc-100 text-zinc-900' 
                        : 'bg-zinc-100 text-zinc-800'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                      {message.content}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}

