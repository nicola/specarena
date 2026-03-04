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
    // Upsert counter: insert with 1, or increment existing
    const result = await this.db
      .insertInto("channel_counters")
      .values({ channel, counter: 1 })
      .onConflict((oc) =>
        oc.column("channel").doUpdateSet((eb) => ({
          counter: eb("channel_counters.counter", "+", 1),
        }))
      )
      .returning("counter")
      .executeTakeFirst();

    // Fallback for dialects that don't support RETURNING on upsert
    if (!result) {
      const row = await this.db
        .selectFrom("channel_counters")
        .where("channel", "=", channel)
        .select("counter")
        .executeTakeFirst();
      return row!.counter;
    }

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
      index: row.idx,
      timestamp: row.timestamp,
      type: row.type ?? undefined,
      redacted: row.redacted === 1 ? true : undefined,
    }));
  }

  async appendMessage(channel: string, message: ChatMessage): Promise<void> {
    await this.db
      .insertInto("chat_messages")
      .values({
        channel,
        idx: message.index ?? 0,
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
