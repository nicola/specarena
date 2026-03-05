import type { Kysely } from "kysely";
import { sql } from "kysely";
import type { Database } from "./schema";
import type { ChatStorageAdapter } from "../InMemoryChatStorageAdapter";
import type { ChatMessage } from "../../types";

export class SqlChatStorageAdapter implements ChatStorageAdapter {
  constructor(private readonly db: Kysely<Database>) {}

  async getNextIndex(channel: string): Promise<number> {
    const result = await this.db
      .selectFrom("chat_messages")
      .select(sql<number>`COALESCE(MAX(message_index), 0) + 1`.as("next_index"))
      .where("channel", "=", channel)
      .executeTakeFirstOrThrow();
    return result.next_index;
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

  async appendMessage(channel: string, message: ChatMessage): Promise<void> {
    // Atomic index assignment inside a transaction to avoid race conditions.
    // Two concurrent appends on the same channel will serialize at the DB write lock.
    await this.db.transaction().execute(async (trx) => {
      const result = await trx
        .selectFrom("chat_messages")
        .select(
          sql<number>`COALESCE(MAX(message_index), 0) + 1`.as("next_index")
        )
        .where("channel", "=", channel)
        .executeTakeFirstOrThrow();

      const index = result.next_index;

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

      // Update the message object so callers see the actual assigned index
      message.index = index;
    });
  }

  async deleteChannel(channel: string): Promise<void> {
    await this.db
      .deleteFrom("chat_messages")
      .where("channel", "=", channel)
      .execute();
  }

  async clearRuntimeState(): Promise<void> {
    await this.db.deleteFrom("chat_messages").execute();
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
