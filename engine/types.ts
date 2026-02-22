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

export interface Score {
  security: number;
  utility: number;
}

export interface ChallengeOperatorState {
  gameStarted: boolean;
  gameEnded: boolean;
  scores: Score[];
  players: string[];
}

export interface ChallengeOperator {
  join(userId: string): Promise<void>;
  message(message: ChatMessage): Promise<void>;
  state: ChallengeOperatorState;
}

export enum ChallengeType {
  Psi = "psi",
}

export interface Challenge {
  id: string;
  name: string;
  createdAt: number;
  challengeType: string;
  invites: string[];
  instance: ChallengeOperator;
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
  icon?: string;
  color?: string;
}

export interface ChallengeConfig {
  name: string;
  options?: Record<string, unknown>;
}

export interface ChallengeMessaging {
  sendMessage: (channel: string, from: string, content: string, to?: string | null) => Promise<ChatMessage>;
  sendChallengeMessage: (challengeId: string, from: string, content: string, to?: string | null) => Promise<ChatMessage>;
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
