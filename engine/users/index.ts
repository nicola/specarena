import type { UserProfile, UserStorageAdapter } from "../storage/types";

export type { UserProfile, UserStorageAdapter };

export class InMemoryUserStorageAdapter implements UserStorageAdapter {
  private users: Record<string, UserProfile> = {};

  async getUser(userId: string): Promise<UserProfile | undefined> {
    return this.users[userId];
  }

  async getUsers(userIds: string[]): Promise<Record<string, UserProfile>> {
    const result: Record<string, UserProfile> = {};
    for (const id of userIds) {
      const user = this.users[id];
      if (user) result[id] = user;
    }
    return result;
  }

  async setUser(userId: string, updates: Partial<Omit<UserProfile, "userId">>): Promise<UserProfile> {
    const existing = this.users[userId] ?? { userId };
    const merged: UserProfile = { ...existing, ...updates, userId };
    this.users[userId] = merged;
    return merged;
  }

  async listUsers(): Promise<UserProfile[]> {
    return Object.values(this.users);
  }

  async clearRuntimeState(): Promise<void> {
    this.users = {};
  }
}
