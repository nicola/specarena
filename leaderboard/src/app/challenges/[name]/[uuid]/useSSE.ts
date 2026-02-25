"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { toChallengeChannel } from "@/lib/chat-utils";

export interface SSEMessageData {
  type: "initial" | "new_message" | "game_ended";
  messages?: ChatMessage[];
  message?: ChatMessage;
  scores?: Score[];
  players?: string[];
  playerIdentities?: Record<string, string>;
}

export interface ChatMessage {
  channel: string;
  from: string;
  to: string | null;
  content: string;
  index: number;
  timestamp: number;
  redacted?: boolean;
}

export interface Score {
  security: number;
  utility: number;
}

export interface GameEndedData {
  scores: Score[];
  players: string[];
  playerIdentities: Record<string, string>;
}

/**
 * Hook that manages dual SSE connections (chat + challenge channels) for a
 * given game UUID.
 *
 * @param uuid      Game session identifier
 * @param engineUrl Base URL for the engine API (defaults to "")
 * @param onMessage Callback invoked for every parsed SSE payload
 * @returns `{ error, reconnect }` — current error string (or null) and a
 *          function to tear down & re-establish both connections.
 */
export function useSSE(
  uuid: string,
  engineUrl: string,
  onMessage: (data: SSEMessageData) => void,
): { error: string | null; reconnect: () => void } {
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const challengeEventSourceRef = useRef<EventSource | null>(null);

  // Keep the latest callback in a ref so the EventSource handlers always
  // invoke the most recent version without needing to re-create them.
  const onMessageRef = useRef(onMessage);
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const connectSSE = useCallback(
    (url: string): EventSource => {
      const es = new EventSource(url);
      es.onmessage = (event) => {
        try {
          onMessageRef.current(JSON.parse(event.data));
        } catch (err) {
          console.error("Error parsing SSE message:", err);
        }
      };
      es.onerror = () => {
        setError("Connection error. Attempting to reconnect...");
      };
      es.onopen = () => {
        setError(null);
      };
      return es;
    },
    [],
  );

  const connect = useCallback(() => {
    // Close existing connections if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    if (challengeEventSourceRef.current) {
      challengeEventSourceRef.current.close();
    }

    const base = engineUrl;
    eventSourceRef.current = connectSSE(`${base}/api/chat/ws/${uuid}`);
    challengeEventSourceRef.current = connectSSE(
      `${base}/api/chat/ws/${toChallengeChannel(uuid)}`,
    );
  }, [uuid, engineUrl, connectSSE]);

  useEffect(() => {
    connect();

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
  }, [connect]);

  return { error, reconnect: connect };
}
