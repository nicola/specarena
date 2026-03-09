import { Challenge } from "../types";
import type { ArenaStorageAdapter, ChallengeQueryOptions, PaginatedResult } from "./types";

const byCreatedAtDesc = (a: Challenge, b: Challenge) => b.createdAt - a.createdAt;

function paginate(items: Challenge[], options?: ChallengeQueryOptions): PaginatedResult<Challenge> {
  const total = items.length;
  if (!options?.limit && !options?.offset) return { items, total };
  const offset = options.offset ?? 0;
  const limit = options.limit ?? total;
  return { items: items.slice(offset, offset + limit), total };
}

export class InMemoryArenaStorageAdapter implements ArenaStorageAdapter {
  private challengesById: Record<string, Challenge> = {};
  private inviteToChallengeId: Record<string, string> = {};

  async clearRuntimeState(): Promise<void> {
    this.challengesById = {};
    this.inviteToChallengeId = {};
  }

  async listChallenges(options?: ChallengeQueryOptions): Promise<PaginatedResult<Challenge>> {
    const all = Object.values(this.challengesById)
      .filter((c) => !options?.status || c.state.status === options.status);
    return paginate(all, options);
  }

  async getChallenge(challengeId: string): Promise<Challenge | undefined> {
    return this.challengesById[challengeId];
  }

  async getChallengeFromInvite(invite: string): Promise<Challenge | undefined> {
    const challengeId = this.inviteToChallengeId[invite];
    return challengeId ? this.challengesById[challengeId] : undefined;
  }

  async getChallengesByType(challengeType: string, options?: ChallengeQueryOptions): Promise<PaginatedResult<Challenge>> {
    const all = Object.values(this.challengesById)
      .filter((c) => c.challengeType === challengeType && (!options?.status || c.state.status === options.status))
      .sort(byCreatedAtDesc);
    return paginate(all, options);
  }

  async getChallengesByUserId(userId: string, options?: ChallengeQueryOptions): Promise<PaginatedResult<Challenge>> {
    const all = Object.values(this.challengesById)
      .filter((c) => {
        const identities = c.state?.playerIdentities;
        return identities && Object.values(identities).includes(userId)
          && (!options?.status || c.state.status === options.status);
      })
      .sort(byCreatedAtDesc);
    return paginate(all, options);
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
