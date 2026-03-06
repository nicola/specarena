import { ChatMessage, ChallengeRecord } from "../types";

// -- Pagination --

export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
}

// -- Arena --

export interface ArenaStorageAdapter {
  clearRuntimeState(): Promise<void>;
  listChallenges(options?: PaginationOptions): Promise<PaginatedResult<ChallengeRecord>>;
  getChallenge(challengeId: string): Promise<ChallengeRecord | undefined>;
  getChallengeFromInvite(invite: string): Promise<ChallengeRecord | undefined>;
  getChallengesByUserId(userId: string, options?: PaginationOptions): Promise<PaginatedResult<ChallengeRecord>>;
  getChallengesByType(challengeType: string, options?: PaginationOptions): Promise<PaginatedResult<ChallengeRecord>>;
  setChallenge(challenge: ChallengeRecord): Promise<void>;
  deleteChallenge(challengeId: string): Promise<void>;
}

// -- Chat --

export interface ChatStorageAdapter {
  clearRuntimeState(): Promise<void>;
  getNextIndex(channel: string): Promise<number>;
  getMessagesForChannel(channel: string): Promise<ChatMessage[]>;
  appendMessage(channel: string, message: ChatMessage): Promise<void>;
  deleteChannel(channel: string): Promise<void>;
}

// -- Users --

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
