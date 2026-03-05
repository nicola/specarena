import type { ChallengeRecord, ChatMessage } from "../types";

export interface ArenaStorageAdapter {
  clearRuntimeState(): Promise<void>;
  listChallenges(): Promise<ChallengeRecord[]>;
  getChallenge(challengeId: string): Promise<ChallengeRecord | undefined>;
  getChallengeFromInvite(invite: string): Promise<ChallengeRecord | undefined>;
  getChallengesByUserId(userId: string): Promise<ChallengeRecord[]>;
  setChallenge(challenge: ChallengeRecord): Promise<void>;
  deleteChallenge(challengeId: string): Promise<void>;
}

export interface ChatStorageAdapter {
  clearRuntimeState(): Promise<void>;
  getNextIndex(channel: string): Promise<number>;
  getMessagesForChannel(channel: string): Promise<ChatMessage[]>;
  appendMessage(channel: string, message: ChatMessage): Promise<void>;
  deleteChannel(channel: string): Promise<void>;
}

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
