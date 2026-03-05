import type { Kysely } from "kysely";
import type { Database } from "./schema";
import type { ChatStorageAdapter } from "../InMemoryChatStorageAdapter";
import type { ChatMessage } from "../../types";

export class SqlChatStorageAdapter implements ChatStorageAdapter {
  constructor(private readonly db: Kysely<Database>) {}

  private async incrementCounter(conn: Kysely<Database>, channel: string): Promise<number> {
    const row = await conn
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
    return this.incrementCounter(this.db, channel);
  }

  async getMessagesForChannel(channel: string): Promise<ChatMessage[]> {
    const rows = await this.db
      .selectFrom("chat_messages")
      .selectAll()
      .where("channel", "=", channel)
      .orderBy("message_index", "asc")
      .execute();
    return rows.map((r) => this.rowToMessage(r));
  }

  async appendMessage(channel: string, message: ChatMessage): Promise<ChatMessage> {
    const stored = await this.db.transaction().execute(async (trx) => {
      const index = await this.incrementCounter(trx as unknown as Kysely<Database>, channel);

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
        })
        .execute();

      return { ...message, index } as ChatMessage;
    });
    return stored;
  }

  async deleteChannel(channel: string): Promise<void> {
    // Messages cascade-deleted via FK on chat_channel_counters
    await this.db
      .deleteFrom("chat_channel_counters")
      .where("channel", "=", channel)
      .execute();
  }

  async clearRuntimeState(): Promise<void> {
    // Messages cascade-deleted via FK on chat_channel_counters
    await this.db.deleteFrom("chat_channel_counters").execute();
  }

  private rowToMessage(row: {
    channel: string;
    message_index: number;
    from_id: string;
    to_id: string | null;
    content: string;
    timestamp: number;
    type: string | null;
  }): ChatMessage {
    const msg: ChatMessage = {
      channel: row.channel,
      from: row.from_id,
      content: row.content,
      index: row.message_index,
      timestamp: row.timestamp,
    };
    if (row.to_id != null) msg.to = row.to_id;
    if (row.type != null) msg.type = row.type;
    return msg;
  }
}
