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

  private cloneChallenge(challenge: Challenge): Challenge {
    return structuredClone(challenge);
  }

  async clearRuntimeState(): Promise<void> {
    this.challengesById = {};
    this.inviteToChallengeId = {};
  }

  async listChallenges(): Promise<Challenge[]> {
    return Object.values(this.challengesById).map((challenge) => this.cloneChallenge(challenge));
  }

  async getChallenge(challengeId: string): Promise<Challenge | undefined> {
    const challenge = this.challengesById[challengeId];
    return challenge ? this.cloneChallenge(challenge) : undefined;
  }

  async getChallengeFromInvite(invite: string): Promise<Challenge | undefined> {
    const challengeId = this.inviteToChallengeId[invite];
    const challenge = challengeId ? this.challengesById[challengeId] : undefined;
    return challenge ? this.cloneChallenge(challenge) : undefined;
  }

  async getChallengesByUserId(userId: string): Promise<Challenge[]> {
    return Object.values(this.challengesById)
      .filter((c) => {
        const identities = c.state.playerIdentities;
        return identities && Object.values(identities).includes(userId);
      })
      .map((challenge) => this.cloneChallenge(challenge))
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  async setChallenge(challenge: Challenge): Promise<void> {
    const prev = this.challengesById[challenge.id];
    if (prev) {
      for (const invite of prev.invites) {
        delete this.inviteToChallengeId[invite];
      }
    }

    this.challengesById[challenge.id] = this.cloneChallenge(challenge);
    for (const invite of challenge.invites) {
      this.inviteToChallengeId[invite] = challenge.id;
    }
  }

  async deleteChallenge(challengeId: string): Promise<void> {
    const challenge = this.challengesById[challengeId];
    if (challenge) {
      for (const invite of challenge.invites) {
        delete this.inviteToChallengeId[invite];
      }
    }
    delete this.challengesById[challengeId];
  }
}
