export const CHALLENGE_CHANNEL_PREFIX = "challenge_";
export const toChallengeChannel = (id: string) => `${CHALLENGE_CHANNEL_PREFIX}${id}`;
export const fromChallengeChannel = (channel: string): string | null =>
  channel.startsWith(CHALLENGE_CHANNEL_PREFIX)
    ? channel.slice(CHALLENGE_CHANNEL_PREFIX.length)
    : null;

export interface ChatMessage {
  channel: string;
  from: string;
  to?: string | null;
  content: string;
  index?: number;
  timestamp: number;
  type?: string;
  redacted?: boolean;
}

import type { Score, Attribution } from "@arena/scoring";
export type { Score, Attribution };

export interface ChallengeOperatorState {
  gameStarted: boolean;
  gameEnded: boolean;
  completedAt?: number;
  scores: Score[];
  players: string[];
  playerIdentities: Record<string, string>; // invite → userId
  attributions?: Attribution[];
}

export interface ChallengeOperator<TGameState = {}> {
  join(invite: string, userId?: string): Promise<void>;
  message(message: ChatMessage): Promise<void>;
  restore(challenge: Challenge<TGameState>): void;
  serialize(): { gameState: TGameState; state: ChallengeOperatorState };
  state: ChallengeOperatorState;
  gameState: TGameState;
}

export type GameCategory = 'benchmark' | 'test' | 'train';

export interface Challenge<TGameState = {}> {
  id: string;
  name: string;
  createdAt: number;
  challengeType: string;
  invites: string[];
  state: ChallengeOperatorState;
  gameState: TGameState;
  gameCategory?: GameCategory;
}

export class ChallengeOperatorError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "ChallengeOperatorError";
  }
}

export enum ChallengeError {
  NOT_FOUND = 'NOT_FOUND',
  INVITE_ALREADY_USED = 'INVITE_ALREADY_USED',
}

export interface ChallengeMetadata {
  name: string;
  description: string;
  players: number;
  prompt: string;
  methods: { name: string; description: string }[];
  authors?: { name: string; url: string }[];
  tags?: string[];
  url?: string;
  icon?: string;
  color?: string;
}

export interface ChallengeConfig {
  name: string;
  options?: Record<string, unknown>;
  scoring?: string[];
}

export interface GameEndedEvent {
  type: "game_ended";
  data: ChallengeOperatorState;
}

export type ChallengeOperatorEvent = GameEndedEvent;

export interface ChallengeMessaging {
  sendMessage: (channel: string, from: string, content: string, to?: string | null) => Promise<ChatMessage>;
  sendChallengeMessage: (challengeId: string, from: string, content: string, to?: string | null) => Promise<ChatMessage>;
  broadcastChallengeEvent?: (challengeId: string, event: ChallengeOperatorEvent) => void;
}

export interface ChallengeFactoryContext {
  messaging: ChallengeMessaging;
}

export type ChallengeFactory = (
  challengeId: string,
  options?: Record<string, unknown>,
  context?: ChallengeFactoryContext
) => ChallengeOperator;

export type Result<T, E = ChallengeError> =
  | { success: true; data: T }
  | { success: false; error: E; message: string };

/** Strip scores and attributions from challenges that haven't ended yet. */
export function sanitizeChallenge<T extends Challenge>(challenge: T): T {
  if (challenge.state.gameEnded) return challenge;
  return {
    ...challenge,
    state: {
      ...challenge.state,
      scores: [],
      attributions: undefined,
    },
  };
}
