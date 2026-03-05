import { eq, asc, sql } from "drizzle-orm";
import type { ChatMessage } from "../../types";
import type { ChatStorageAdapter } from "../InMemoryChatStorageAdapter";
import { chatMessages, chatChannelCounters } from "./schema";
import type { Db } from "./db";

export class SqlChatStorageAdapter implements ChatStorageAdapter {
  constructor(private readonly db: Db) {}

  async clearRuntimeState(): Promise<void> {
    await this.db.delete(chatMessages);
    await this.db.delete(chatChannelCounters);
  }

  async getNextIndex(channel: string): Promise<number> {
    // Atomic upsert + increment: insert with next_index=1 or increment existing
    const rows = await this.db
      .insert(chatChannelCounters)
      .values({ channel, nextIndex: 1 })
      .onConflictDoUpdate({
        target: chatChannelCounters.channel,
        set: {
          nextIndex: sql`${chatChannelCounters.nextIndex} + 1`,
        },
      })
      .returning({ nextIndex: chatChannelCounters.nextIndex });

    return rows[0].nextIndex;
  }

  async appendMessage(channel: string, message: ChatMessage): Promise<void> {
    await this.db.insert(chatMessages).values({
      channel,
      index: message.index ?? 0,
      from: message.from,
      to: message.to ?? null,
      content: message.content,
      timestamp: message.timestamp,
      type: message.type ?? null,
      redacted: message.redacted ?? false,
    });
  }

  async getMessagesForChannel(channel: string): Promise<ChatMessage[]> {
    const rows = await this.db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.channel, channel))
      .orderBy(asc(chatMessages.index));

    return rows.map((row) => {
      const msg: ChatMessage = {
        channel: row.channel,
        from: row.from,
        content: row.content,
        index: row.index,
        timestamp: row.timestamp ?? Date.now(),
      };
      if (row.to !== null) msg.to = row.to;
      if (row.type !== null) msg.type = row.type;
      if (row.redacted) msg.redacted = row.redacted;
      return msg;
    });
  }

  async deleteChannel(channel: string): Promise<void> {
    await this.db
      .delete(chatMessages)
      .where(eq(chatMessages.channel, channel));
    await this.db
      .delete(chatChannelCounters)
      .where(eq(chatChannelCounters.channel, channel));
  }
}
