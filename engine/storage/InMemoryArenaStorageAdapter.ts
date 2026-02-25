import { Challenge } from "../types";

export interface ArenaStorageAdapter {
  clearRuntimeState(): Promise<void>;
  listChallenges(): Promise<Challenge[]>;
  getChallenge(challengeId: string): Promise<Challenge | undefined>;
  setChallenge(challenge: Challenge): Promise<void>;
  deleteChallenge(challengeId: string): Promise<void>;
}

export class InMemoryArenaStorageAdapter implements ArenaStorageAdapter {
  private challengesById: Record<string, Challenge> = {};

  async clearRuntimeState(): Promise<void> {
    this.challengesById = {};
  }

  async listChallenges(): Promise<Challenge[]> {
    return Object.values(this.challengesById);
  }

  async getChallenge(challengeId: string): Promise<Challenge | undefined> {
    return this.challengesById[challengeId];
  }

  async setChallenge(challenge: Challenge): Promise<void> {
    this.challengesById[challenge.id] = challenge;
  }

  async deleteChallenge(challengeId: string): Promise<void> {
    delete this.challengesById[challengeId];
  }
}
