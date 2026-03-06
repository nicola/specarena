import { ChallengeRecord } from "../types";

export interface ArenaStorageAdapter {
  clearRuntimeState(): Promise<void>;
  listChallenges(): Promise<ChallengeRecord[]>;
  getChallenge(challengeId: string): Promise<ChallengeRecord | undefined>;
  getChallengeFromInvite(invite: string): Promise<ChallengeRecord | undefined>;
  getChallengesByUserId(userId: string): Promise<ChallengeRecord[]>;
  getChallengesByType(challengeType: string): Promise<ChallengeRecord[]>;
  setChallenge(challenge: ChallengeRecord): Promise<void>;
  deleteChallenge(challengeId: string): Promise<void>;
}

export class InMemoryArenaStorageAdapter implements ArenaStorageAdapter {
  private challengesById: Record<string, ChallengeRecord> = {};
  private inviteToChallengeId: Record<string, string> = {};

  async clearRuntimeState(): Promise<void> {
    this.challengesById = {};
    this.inviteToChallengeId = {};
  }

  async listChallenges(): Promise<ChallengeRecord[]> {
    return Object.values(this.challengesById);
  }

  async getChallenge(challengeId: string): Promise<ChallengeRecord | undefined> {
    return this.challengesById[challengeId];
  }

  async getChallengeFromInvite(invite: string): Promise<ChallengeRecord | undefined> {
    const challengeId = this.inviteToChallengeId[invite];
    return challengeId ? this.challengesById[challengeId] : undefined;
  }

  async getChallengesByUserId(userId: string): Promise<ChallengeRecord[]> {
    return Object.values(this.challengesById)
      .filter((c) => {
        const identities = c.state.playerIdentities;
        return identities && Object.values(identities).includes(userId);
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  async getChallengesByType(challengeType: string): Promise<ChallengeRecord[]> {
    return Object.values(this.challengesById)
      .filter((c) => c.challengeType === challengeType)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  async setChallenge(challenge: ChallengeRecord): Promise<void> {
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
