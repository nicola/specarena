import type Database from "better-sqlite3";
import { Challenge } from "../types";
import { ArenaStorageAdapter, SerializedChallenge } from "./ArenaStorageAdapter";
import { serializeState, deserializeState } from "./serialize";

export class SqliteArenaStorageAdapter implements ArenaStorageAdapter {
  private db: Database.Database;
  private cache: Map<string, Challenge> = new Map();

  constructor(db: Database.Database) {
    this.db = db;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS challenges (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        challenge_type TEXT NOT NULL,
        invites TEXT NOT NULL,
        operator_state TEXT NOT NULL,
        game_state TEXT NOT NULL
      )
    `);
  }

  async clearRuntimeState(): Promise<void> {
    this.cache.clear();
    this.db.exec("DELETE FROM challenges");
  }

  async listChallenges(): Promise<Challenge[]> {
    return [...this.cache.values()];
  }

  async getChallenge(challengeId: string): Promise<Challenge | undefined> {
    return this.cache.get(challengeId);
  }

  async setChallenge(challenge: Challenge): Promise<void> {
    this.cache.set(challenge.id, challenge);
    this.db
      .prepare(
        `INSERT OR REPLACE INTO challenges (id, name, created_at, challenge_type, invites, operator_state, game_state)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        challenge.id,
        challenge.name,
        challenge.createdAt,
        challenge.challengeType,
        JSON.stringify(challenge.invites),
        serializeState(challenge.instance.state),
        serializeState(challenge.instance.gameState)
      );
  }

  async listSerializedChallenges(): Promise<SerializedChallenge[]> {
    const rows = this.db
      .prepare("SELECT * FROM challenges")
      .all() as {
        id: string;
        name: string;
        created_at: number;
        challenge_type: string;
        invites: string;
        operator_state: string;
        game_state: string;
      }[];

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      challengeType: row.challenge_type,
      invites: JSON.parse(row.invites),
      operatorState: deserializeState(row.operator_state) as SerializedChallenge["operatorState"],
      gameState: deserializeState(row.game_state),
    }));
  }
}
