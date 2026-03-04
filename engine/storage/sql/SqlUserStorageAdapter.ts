import type { Kysely } from "kysely";
import type { Database } from "./schema";
import type { UserProfile, UserStorageAdapter } from "../../users/index";

export class SqlUserStorageAdapter implements UserStorageAdapter {
  constructor(private readonly db: Kysely<Database>) {}

  async getUser(userId: string): Promise<UserProfile | undefined> {
    const row = await this.db
      .selectFrom("users")
      .selectAll()
      .where("user_id", "=", userId)
      .executeTakeFirst();
    return row ? this.rowToProfile(row) : undefined;
  }

  async getUsers(userIds: string[]): Promise<Record<string, UserProfile>> {
    if (userIds.length === 0) return {};
    const rows = await this.db
      .selectFrom("users")
      .selectAll()
      .where("user_id", "in", userIds)
      .execute();
    const result: Record<string, UserProfile> = {};
    for (const row of rows) {
      result[row.user_id] = this.rowToProfile(row);
    }
    return result;
  }

  async setUser(
    userId: string,
    updates: Partial<Omit<UserProfile, "userId">>
  ): Promise<UserProfile> {
    const existing = await this.getUser(userId);
    const merged: UserProfile = { ...existing, ...updates, userId };

    await this.db
      .insertInto("users")
      .values({
        user_id: userId,
        username: merged.username ?? null,
        model: merged.model ?? null,
      })
      .onConflict((oc) =>
        oc.column("user_id").doUpdateSet({
          username: merged.username ?? null,
          model: merged.model ?? null,
        })
      )
      .execute();

    return merged;
  }

  async listUsers(): Promise<UserProfile[]> {
    const rows = await this.db.selectFrom("users").selectAll().execute();
    return rows.map((r) => this.rowToProfile(r));
  }

  async clearRuntimeState(): Promise<void> {
    await this.db.deleteFrom("users").execute();
  }

  private rowToProfile(row: {
    user_id: string;
    username: string | null;
    model: string | null;
  }): UserProfile {
    const profile: UserProfile = { userId: row.user_id };
    if (row.username != null) profile.username = row.username;
    if (row.model != null) profile.model = row.model;
    return profile;
  }
}
