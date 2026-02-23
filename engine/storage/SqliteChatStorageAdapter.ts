import type Database from "better-sqlite3";
import { ChatMessage } from "../types";
import { ChatStorageAdapter } from "./ChatStorageAdapter";

export class SqliteChatStorageAdapter implements ChatStorageAdapter {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel TEXT NOT NULL,
        idx INTEGER NOT NULL,
        from_id TEXT NOT NULL,
        to_id TEXT,
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        type TEXT,
        redacted INTEGER NOT NULL DEFAULT 0
      )
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_chat_messages_channel_idx
      ON chat_messages (channel, idx)
    `);
  }

  async clearRuntimeState(): Promise<void> {
    this.db.exec("DELETE FROM chat_messages");
  }

  async getNextIndex(channel: string): Promise<number> {
    const row = this.db
      .prepare("SELECT MAX(idx) as max_idx FROM chat_messages WHERE channel = ?")
      .get(channel) as { max_idx: number | null } | undefined;
    return (row?.max_idx ?? 0) + 1;
  }

  async getMessagesForChannel(channel: string): Promise<ChatMessage[]> {
    const rows = this.db
      .prepare("SELECT * FROM chat_messages WHERE channel = ? ORDER BY idx")
      .all(channel) as {
        channel: string;
        idx: number;
        from_id: string;
        to_id: string | null;
        content: string;
        timestamp: number;
        type: string | null;
        redacted: number;
      }[];

    return rows.map((row) => ({
      channel: row.channel,
      from: row.from_id,
      to: row.to_id,
      content: row.content,
      index: row.idx,
      timestamp: row.timestamp,
      type: row.type ?? undefined,
      redacted: row.redacted === 1 ? true : undefined,
    }));
  }

  async appendMessage(channel: string, message: ChatMessage): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO chat_messages (channel, idx, from_id, to_id, content, timestamp, type, redacted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        channel,
        message.index ?? 0,
        message.from,
        message.to ?? null,
        message.content,
        message.timestamp,
        message.type ?? null,
        message.redacted ? 1 : 0
      );
  }
}
