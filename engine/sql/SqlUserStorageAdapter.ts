import type { Kysely } from "kysely";
import type { Database } from "./db";
import type { UserStorageAdapter, UserProfile } from "../users";

export class SqlUserStorageAdapter implements UserStorageAdapter {
  constructor(private db: Kysely<Database>) {}

  async getUser(userId: string): Promise<UserProfile | undefined> {
    const row = await this.db
      .selectFrom("users")
      .where("user_id", "=", userId)
      .selectAll()
      .executeTakeFirst();

    if (!row) return undefined;
    return toUserProfile(row);
  }

  async getUsers(userIds: string[]): Promise<Record<string, UserProfile>> {
    if (userIds.length === 0) return {};

    const rows = await this.db
      .selectFrom("users")
      .where("user_id", "in", userIds)
      .selectAll()
      .execute();

    const result: Record<string, UserProfile> = {};
    for (const row of rows) {
      result[row.user_id] = toUserProfile(row);
    }
    return result;
  }

  async setUser(
    userId: string,
    updates: Partial<Omit<UserProfile, "userId">>
  ): Promise<UserProfile> {
    // Try to get existing user first
    const existing = await this.getUser(userId);

    if (existing) {
      // Update only provided fields
      const toSet: Record<string, unknown> = {};
      if (updates.username !== undefined) toSet.username = updates.username ?? null;
      if (updates.model !== undefined) toSet.model = updates.model ?? null;

      if (Object.keys(toSet).length > 0) {
        await this.db
          .updateTable("users")
          .set(toSet)
          .where("user_id", "=", userId)
          .execute();
      }

      return { ...existing, ...updates, userId };
    }

    // Insert new user
    await this.db
      .insertInto("users")
      .values({
        user_id: userId,
        username: updates.username ?? null,
        model: updates.model ?? null,
      })
      .execute();

    return { userId, ...updates };
  }

  async listUsers(): Promise<UserProfile[]> {
    const rows = await this.db.selectFrom("users").selectAll().execute();
    return rows.map(toUserProfile);
  }

  async clearRuntimeState(): Promise<void> {
    await this.db.deleteFrom("users").execute();
  }
}

function toUserProfile(row: {
  user_id: string;
  username: string | null;
  model: string | null;
}): UserProfile {
  const profile: UserProfile = { userId: row.user_id };
  if (row.username != null) profile.username = row.username;
  if (row.model != null) profile.model = row.model;
  return profile;
}
