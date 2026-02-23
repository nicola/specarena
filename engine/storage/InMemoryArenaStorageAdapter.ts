import { Challenge } from "../types";
import { ArenaStorageAdapter } from "./ArenaStorageAdapter";

export { ArenaStorageAdapter } from "./ArenaStorageAdapter";
export { SerializedChallenge } from "./ArenaStorageAdapter";

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
}
