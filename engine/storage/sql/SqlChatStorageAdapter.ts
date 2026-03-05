import type { Kysely } from "kysely";
import type { Database } from "./schema";
import type { ChatStorageAdapter } from "../InMemoryChatStorageAdapter";
import type { ChatMessage } from "../../types";

export class SqlChatStorageAdapter implements ChatStorageAdapter {
  constructor(private readonly db: Kysely<Database>) {}

  private async getNextIndexWithDb(db: Kysely<Database>, channel: string): Promise<number> {
    const row = await db
      .insertInto("chat_channel_counters")
      .values({ channel, next_index: 1 })
      .onConflict((oc) =>
        oc.column("channel").doUpdateSet((eb) => ({
          next_index: eb("chat_channel_counters.next_index", "+", 1),
        }))
      )
      .returning("next_index")
      .executeTakeFirstOrThrow();
    return row.next_index;
  }

  async getNextIndex(channel: string): Promise<number> {
    return this.getNextIndexWithDb(this.db, channel);
  }

  async getMessagesForChannel(channel: string): Promise<ChatMessage[]> {
    const rows = await this.db
      .selectFrom("chat_messages")
      .selectAll()
      .where("channel", "=", channel)
      .orderBy("message_index", "asc")
      .execute();
    return rows.map((row) => ({
      channel: row.channel,
      from: row.from_id,
      to: row.to_id,
      content: row.content,
      index: row.message_index,
      timestamp: row.timestamp,
      type: row.type ?? undefined,
      redacted: row.redacted === 1 ? true : undefined,
    }));
  }

  async appendMessage(channel: string, message: ChatMessage): Promise<ChatMessage> {
    const stored = await this.db.transaction().execute(async (trx) => {
      const index = message.index ?? await this.getNextIndexWithDb(trx, channel);

      await trx
        .insertInto("chat_messages")
        .values({
          channel,
          message_index: index,
          from_id: message.from,
          to_id: message.to ?? null,
          content: message.content ?? "",
          timestamp: message.timestamp,
          type: message.type ?? null,
          redacted: message.redacted ? 1 : 0,
        })
        .execute();

      return { ...message, index } as ChatMessage;
    });
    return stored;
  }

  async deleteChannel(channel: string): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      await trx
        .deleteFrom("chat_messages")
        .where("channel", "=", channel)
        .execute();
      await trx
        .deleteFrom("chat_channel_counters")
        .where("channel", "=", channel)
        .execute();
    });
  }

  async clearRuntimeState(): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      await trx.deleteFrom("chat_messages").execute();
      await trx.deleteFrom("chat_channel_counters").execute();
    });
  }
}
