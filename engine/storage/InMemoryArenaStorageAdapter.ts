import { Challenge } from "../types";
import type { ArenaStorageAdapter } from "./types";

const byCreatedAtDesc = (a: Challenge, b: Challenge) => b.createdAt - a.createdAt;

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

  async getChallengesByType(challengeType: string): Promise<Challenge[]> {
    return Object.values(this.challengesById)
      .filter((c) => c.challengeType === challengeType)
      .sort(byCreatedAtDesc);
  }

  async getChallengesByUserId(userId: string): Promise<Challenge[]> {
    return Object.values(this.challengesById)
      .filter((c) => {
        const identities = c.state?.playerIdentities;
        return identities && Object.values(identities).includes(userId);
      })
      .sort(byCreatedAtDesc);
  }

  async setChallenge(challenge: Challenge): Promise<void> {
    const prev = this.challengesById[challenge.id];
    if (prev) {
      this.removeInviteIndex(prev);
    }

    this.challengesById[challenge.id] = challenge;
    for (const invite of challenge.invites) {
      this.inviteToChallengeId[invite] = challenge.id;
    }
  }

  async deleteChallenge(challengeId: string): Promise<void> {
    const challenge = this.challengesById[challengeId];
    if (challenge) {
      this.removeInviteIndex(challenge);
    }
    delete this.challengesById[challengeId];
  }

  private removeInviteIndex(challenge: Challenge): void {
    for (const invite of challenge.invites) {
      delete this.inviteToChallengeId[invite];
    }
  }
}
