import { ChallengeRecord } from "../types";
import type { ArenaStorageAdapter, PaginationOptions, PaginatedResult } from "./types";

function applyPagination<T>(items: T[], options?: PaginationOptions): PaginatedResult<T> {
  const total = items.length;
  if (!options?.limit && !options?.offset) return { items, total };
  const offset = options.offset ?? 0;
  const limit = options.limit ?? total;
  return { items: items.slice(offset, offset + limit), total };
}

export class InMemoryArenaStorageAdapter implements ArenaStorageAdapter {
  private challengesById: Record<string, ChallengeRecord> = {};
  private inviteToChallengeId: Record<string, string> = {};

  async clearRuntimeState(): Promise<void> {
    this.challengesById = {};
    this.inviteToChallengeId = {};
  }

  async listChallenges(options?: PaginationOptions): Promise<PaginatedResult<ChallengeRecord>> {
    return applyPagination(Object.values(this.challengesById), options);
  }

  async getChallenge(challengeId: string): Promise<ChallengeRecord | undefined> {
    return this.challengesById[challengeId];
  }

  async getChallengeFromInvite(invite: string): Promise<ChallengeRecord | undefined> {
    const challengeId = this.inviteToChallengeId[invite];
    return challengeId ? this.challengesById[challengeId] : undefined;
  }

  async getChallengesByUserId(userId: string, options?: PaginationOptions): Promise<PaginatedResult<ChallengeRecord>> {
    const filtered = Object.values(this.challengesById)
      .filter((c) => {
        const identities = c.state.playerIdentities;
        return identities && Object.values(identities).includes(userId);
      })
      .sort((a, b) => b.createdAt - a.createdAt);
    return applyPagination(filtered, options);
  }

  async getChallengesByType(challengeType: string, options?: PaginationOptions): Promise<PaginatedResult<ChallengeRecord>> {
    const filtered = Object.values(this.challengesById)
      .filter((c) => c.challengeType === challengeType)
      .sort((a, b) => b.createdAt - a.createdAt);
    return applyPagination(filtered, options);
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
    const prev = this.challengesById[challengeId];
    if (prev) {
      for (const invite of prev.invites) {
        delete this.inviteToChallengeId[invite];
      }
    }
    delete this.challengesById[challengeId];
  }
}
