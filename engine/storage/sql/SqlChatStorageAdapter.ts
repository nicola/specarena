import type { Kysely } from "kysely";
import { sql } from "kysely";
import type { Database } from "./schema";
import type { ChatStorageAdapter } from "../types";
import type { ChatMessage } from "../../types";

export class SqlChatStorageAdapter implements ChatStorageAdapter {
  constructor(private readonly db: Kysely<Database>) {}

  async getMessagesForChannel(channel: string): Promise<ChatMessage[]> {
    const rows = await this.db
      .selectFrom("chat_messages")
      .selectAll()
      .where("channel", "=", channel)
      .orderBy("index", "asc")
      .execute();

    return rows.map((r) => ({
      channel: r.channel,
      from: r.from,
      to: r.to ?? undefined,
      content: r.content,
      index: r.index,
      timestamp: r.timestamp.getTime(),
      type: r.type ?? undefined,
    }));
  }

  async appendMessage(channel: string, message: Omit<ChatMessage, "index">): Promise<ChatMessage> {
    // Atomic index assignment: MAX(index) + 1 in a single INSERT ... SELECT
    const result = await this.db
      .insertInto("chat_messages")
      .columns(["channel", "index", "from", "to", "content", "timestamp", "type"])
      .expression(
        this.db
          .selectNoFrom(({ fn, val, lit }) => [
            val(channel).as("channel"),
            sql<number>`coalesce((select max("index") from chat_messages where channel = ${channel}), 0) + 1`.as("index"),
            val(message.from).as("from"),
            val(message.to ?? null).as("to"),
            val(message.content).as("content"),
            val(new Date(message.timestamp)).as("timestamp"),
            val(message.type ?? null).as("type"),
          ]),
      )
      .returning(["index"])
      .executeTakeFirstOrThrow();

    return { ...message, index: result.index };
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
}
