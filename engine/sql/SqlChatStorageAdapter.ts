import type { Kysely } from "kysely";
import type { Database } from "./db";
import type { ChatStorageAdapter } from "../storage/InMemoryChatStorageAdapter";
import type { ChatMessage } from "../types";

export class SqlChatStorageAdapter implements ChatStorageAdapter {
  constructor(private db: Kysely<Database>) {}

  async clearRuntimeState(): Promise<void> {
    await this.db.deleteFrom("chat_messages").execute();
    await this.db.deleteFrom("channel_counters").execute();
  }

  async getNextIndex(channel: string): Promise<number> {
    // Atomic upsert: insert with 1, or increment existing.
    // Requires a dialect that supports RETURNING (SQLite 3.35+, Postgres).
    const result = await this.db
      .insertInto("channel_counters")
      .values({ channel, counter: 1 })
      .onConflict((oc) =>
        oc.column("channel").doUpdateSet((eb) => ({
          counter: eb("channel_counters.counter", "+", 1),
        }))
      )
      .returning("counter")
      .executeTakeFirstOrThrow();

    return result.counter;
  }

  async getMessagesForChannel(channel: string): Promise<ChatMessage[]> {
    const rows = await this.db
      .selectFrom("chat_messages")
      .where("channel", "=", channel)
      .orderBy("id", "asc")
      .selectAll()
      .execute();

    return rows.map((row) => ({
      channel: row.channel,
      from: row.from_id,
      to: row.to_id ?? undefined,
      content: row.content,
      index: row.idx ?? undefined,
      timestamp: row.timestamp,
      type: row.type ?? undefined,
      redacted: row.redacted === 1,
    }));
  }

  async appendMessage(channel: string, message: ChatMessage): Promise<void> {
    await this.db
      .insertInto("chat_messages")
      .values({
        channel,
        idx: message.index ?? null,
        from_id: message.from,
        to_id: message.to ?? null,
        content: message.content,
        timestamp: message.timestamp,
        type: message.type ?? null,
        redacted: message.redacted ? 1 : 0,
      })
      .execute();
  }

  async deleteChannel(channel: string): Promise<void> {
    await this.db
      .deleteFrom("chat_messages")
      .where("channel", "=", channel)
      .execute();
    await this.db
      .deleteFrom("channel_counters")
      .where("channel", "=", channel)
      .execute();
  }
}
