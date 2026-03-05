import { eq, inArray } from "drizzle-orm";
import type { UserProfile, UserStorageAdapter } from "../../users";
import { users } from "./schema";
import type { Db } from "./db";

export class SqlUserStorageAdapter implements UserStorageAdapter {
  constructor(private readonly db: Db) {}

  async getUser(userId: string): Promise<UserProfile | undefined> {
    const row = await this.db
      .select()
      .from(users)
      .where(eq(users.userId, userId))
      .limit(1)
      .then((rows) => rows[0]);
    return row ? this.rowToProfile(row) : undefined;
  }

  async getUsers(userIds: string[]): Promise<Record<string, UserProfile>> {
    if (userIds.length === 0) return {};
    const rows = await this.db
      .select()
      .from(users)
      .where(inArray(users.userId, userIds));
    const result: Record<string, UserProfile> = {};
    for (const row of rows) {
      result[row.userId] = this.rowToProfile(row);
    }
    return result;
  }

  async setUser(
    userId: string,
    updates: Partial<Omit<UserProfile, "userId">>,
  ): Promise<UserProfile> {
    const hasUpdates = Object.keys(updates).length > 0;

    const rows = hasUpdates
      ? await this.db
          .insert(users)
          .values({ userId, ...updates })
          .onConflictDoUpdate({
            target: users.userId,
            set: updates,
          })
          .returning()
      : await this.db
          .insert(users)
          .values({ userId })
          .onConflictDoNothing()
          .returning();

    // onConflictDoNothing returns no rows if the user already exists
    if (rows.length === 0) {
      const existing = await this.getUser(userId);
      return existing!;
    }

    return this.rowToProfile(rows[0]);
  }

  async listUsers(): Promise<UserProfile[]> {
    const rows = await this.db.select().from(users);
    return rows.map((r) => this.rowToProfile(r));
  }

  async clearRuntimeState(): Promise<void> {
    await this.db.delete(users);
  }

  private rowToProfile(row: typeof users.$inferSelect): UserProfile {
    const profile: UserProfile = { userId: row.userId };
    if (row.username !== null) profile.username = row.username;
    if (row.model !== null) profile.model = row.model;
    return profile;
  }
}
