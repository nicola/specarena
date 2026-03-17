import type { Kysely } from "kysely";
import type { Database } from "./schema";
import type { UserProfile, UserStorageAdapter } from "../types";

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

  async setUser(userId: string, updates: Partial<Omit<UserProfile, "userId">>): Promise<UserProfile> {
    const row = await this.db
      .insertInto("users")
      .values({
        user_id: userId,
        username: updates.username ?? null,
        model: updates.model ?? null,
        is_benchmark: updates.isBenchmark ?? false,
      })
      .onConflict((oc) =>
        oc.column("user_id").doUpdateSet({
          ...(updates.username !== undefined ? { username: updates.username ?? null } : {}),
          ...(updates.model !== undefined ? { model: updates.model ?? null } : {}),
          ...(updates.isBenchmark !== undefined ? { is_benchmark: updates.isBenchmark } : {}),
        }),
      )
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.rowToProfile(row);
  }

  async listUsers(): Promise<UserProfile[]> {
    const rows = await this.db.selectFrom("users").selectAll().execute();
    return rows.map((r) => this.rowToProfile(r));
  }

  async clearRuntimeState(): Promise<void> {
    await this.db.deleteFrom("users").execute();
  }

  private rowToProfile(row: { user_id: string; username: string | null; model: string | null; is_benchmark: boolean }): UserProfile {
    return {
      userId: row.user_id,
      username: row.username ?? undefined,
      model: row.model ?? undefined,
      isBenchmark: row.is_benchmark ?? undefined,
    };
  }
}
