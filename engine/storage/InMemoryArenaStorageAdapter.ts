import { Challenge } from "../types";

export interface ArenaStorageAdapter {
  clearRuntimeState(): Promise<void>;
  listChallenges(): Promise<Challenge[]>;
  getChallenge(challengeId: string): Promise<Challenge | undefined>;
  getChallengeFromInvite(invite: string): Promise<Challenge | undefined>;
  getChallengesByUserId(userId: string): Promise<Challenge[]>;
  setChallenge(challenge: Challenge): Promise<void>;
  deleteChallenge(challengeId: string): Promise<void>;
}

export class InMemoryArenaStorageAdapter implements ArenaStorageAdapter {
  private challengesById: Record<string, Challenge> = {};
  private inviteToChallengeId: Record<string, string> = {};

  async clearRuntimeState(): Promise<void> {
    this.challengesById = {};
    this.inviteToChallengeId = {};
  }

  async listChallenges(): Promise<Challenge[]> {
    return Object.values(this.challengesById);
  }

  async getChallenge(challengeId: string): Promise<Challenge | undefined> {
    return this.challengesById[challengeId];
  }

  async getChallengeFromInvite(invite: string): Promise<Challenge | undefined> {
    const challengeId = this.inviteToChallengeId[invite];
    return challengeId ? this.challengesById[challengeId] : undefined;
  }

  async getChallengesByUserId(userId: string): Promise<Challenge[]> {
    return Object.values(this.challengesById)
      .filter((c) => {
        const identities = c.instance?.state?.playerIdentities;
        return identities && Object.values(identities).includes(userId);
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  async setChallenge(challenge: Challenge): Promise<void> {
    const prev = this.challengesById[challenge.id];
    if (prev) {
      for (const invite of prev.invites) {
        delete this.inviteToChallengeId[invite];
      }
    }

    this.challengesById[challenge.id] = challenge;
    for (const invite of challenge.invites) {
      this.inviteToChallengeId[invite] = challenge.id;
    }
  }

  async deleteChallenge(challengeId: string): Promise<void> {
    delete this.challengesById[challengeId];
  }
}
