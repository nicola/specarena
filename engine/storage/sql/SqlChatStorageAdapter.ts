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
    return rows.map((r) => this.rowToMessage(r));
  }

  async appendMessage(channel: string, message: ChatMessage): Promise<ChatMessage> {
    const stored = await this.db.transaction().execute(async (trx) => {
      let index: number;
      if (message.index != null) {
        index = message.index;
        // Sync counter to stay in sync with pre-assigned indices
        await trx
          .insertInto("chat_channel_counters")
          .values({ channel, next_index: index })
          .onConflict((oc) =>
            oc.column("channel").doUpdateSet((eb) => ({
              next_index: eb.fn("MAX", [
                eb.ref("chat_channel_counters.next_index"),
                eb.val(index),
              ]),
            }))
          )
          .execute();
      } else {
        index = await this.getNextIndexWithDb(trx, channel);
      }

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
