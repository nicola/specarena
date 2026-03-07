import { Challenge, ChatMessage } from "../types";

// ── Arena (challenges) storage ──────────────────────────────────────

export interface ArenaStorageAdapter {
  getChallenge(challengeId: string): Promise<Challenge | undefined>;
  getChallengeFromInvite(invite: string): Promise<Challenge | undefined>;
  getChallengesByType(challengeType: string): Promise<Challenge[]>;
  getChallengesByUserId(userId: string): Promise<Challenge[]>;
  listChallenges(): Promise<Challenge[]>;
  setChallenge(challenge: Challenge): Promise<void>;
  deleteChallenge(challengeId: string): Promise<void>;
  clearRuntimeState(): Promise<void>;
}

// ── Chat storage ────────────────────────────────────────────────────

export interface ChatStorageAdapter {
  getMessagesForChannel(channel: string): Promise<ChatMessage[]>;
  /** Assign the next index atomically and store the message. Returns the message with index set. */
  appendMessage(channel: string, message: Omit<ChatMessage, "index">): Promise<ChatMessage>;
  deleteChannel(channel: string): Promise<void>;
  clearRuntimeState(): Promise<void>;
}

// ── User storage ────────────────────────────────────────────────────

export interface UserProfile {
  userId: string;
  username?: string;
  model?: string;
}

export interface UserStorageAdapter {
  getUser(userId: string): Promise<UserProfile | undefined>;
  getUsers(userIds: string[]): Promise<Record<string, UserProfile>>;
  setUser(userId: string, updates: Partial<Omit<UserProfile, "userId">>): Promise<UserProfile>;
  listUsers(): Promise<UserProfile[]>;
  clearRuntimeState(): Promise<void>;
}
