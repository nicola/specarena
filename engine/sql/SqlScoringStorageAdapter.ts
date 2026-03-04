import type { Kysely, Transaction } from "kysely";
import type { Database } from "./db";
import type { ScoringEntry, ScoringStorageAdapter } from "@arena/scoring";

export class SqlScoringStorageAdapter implements ScoringStorageAdapter {
  constructor(private db: Kysely<Database> | Transaction<Database>) {}

  async getScores(
    challengeType: string
  ): Promise<Record<string, ScoringEntry[]>> {
    const rows = await this.db
      .selectFrom("score_entries")
      .where("challenge_type", "=", challengeType)
      .selectAll()
      .execute();

    const result: Record<string, ScoringEntry[]> = {};
    for (const row of rows) {
      if (!result[row.strategy_name]) result[row.strategy_name] = [];
      result[row.strategy_name].push({
        playerId: row.player_id,
        gamesPlayed: row.games_played,
        metrics: JSON.parse(row.metrics),
      });
    }
    return result;
  }

  async getGlobalScores(): Promise<ScoringEntry[]> {
    const rows = await this.db
      .selectFrom("global_score_entries")
      .selectAll()
      .execute();

    return rows.map((row) => ({
      playerId: row.player_id,
      gamesPlayed: row.games_played,
      metrics: JSON.parse(row.metrics),
    }));
  }

  async clear(): Promise<void> {
    await this.db.deleteFrom("score_entries").execute();
    await this.db.deleteFrom("global_score_entries").execute();
    await this.db.deleteFrom("strategy_state").execute();
    await this.db.deleteFrom("global_strategy_state").execute();
  }

  async transaction<T>(
    fn: (store: ScoringStorageAdapter) => Promise<T>
  ): Promise<T> {
    // If we're already in a transaction, just run the function directly
    if ("isTransaction" in this.db) {
      return fn(this);
    }

    return (this.db as Kysely<Database>).transaction().execute((trx) => {
      return fn(new SqlScoringStorageAdapter(trx));
    });
  }

  async waitForIdle(): Promise<void> {
    // No-op — the DB handles serialization natively
  }

  async getStrategyState<T>(
    challengeType: string,
    strategyName: string,
    playerId: string
  ): Promise<T | undefined> {
    const row = await this.db
      .selectFrom("strategy_state")
      .where("challenge_type", "=", challengeType)
      .where("strategy_name", "=", strategyName)
      .where("player_id", "=", playerId)
      .select("state")
      .executeTakeFirst();

    return row ? JSON.parse(row.state) : undefined;
  }

  async setStrategyState<T>(
    challengeType: string,
    strategyName: string,
    playerId: string,
    state: T
  ): Promise<void> {
    await this.db
      .insertInto("strategy_state")
      .values({
        challenge_type: challengeType,
        strategy_name: strategyName,
        player_id: playerId,
        state: JSON.stringify(state),
      })
      .onConflict((oc) =>
        oc
          .columns(["challenge_type", "strategy_name", "player_id"])
          .doUpdateSet({ state: JSON.stringify(state) })
      )
      .execute();
  }

  async getGlobalStrategyState<T>(playerId: string): Promise<T | undefined> {
    const row = await this.db
      .selectFrom("global_strategy_state")
      .where("player_id", "=", playerId)
      .select("state")
      .executeTakeFirst();

    return row ? JSON.parse(row.state) : undefined;
  }

  async setGlobalStrategyState<T>(
    playerId: string,
    state: T
  ): Promise<void> {
    await this.db
      .insertInto("global_strategy_state")
      .values({
        player_id: playerId,
        state: JSON.stringify(state),
      })
      .onConflict((oc) =>
        oc.column("player_id").doUpdateSet({ state: JSON.stringify(state) })
      )
      .execute();
  }

  async setScoreEntry(
    challengeType: string,
    strategyName: string,
    entry: ScoringEntry
  ): Promise<void> {
    await this.db
      .insertInto("score_entries")
      .values({
        challenge_type: challengeType,
        strategy_name: strategyName,
        player_id: entry.playerId,
        games_played: entry.gamesPlayed,
        metrics: JSON.stringify(entry.metrics),
      })
      .onConflict((oc) =>
        oc
          .columns(["challenge_type", "strategy_name", "player_id"])
          .doUpdateSet({
            games_played: entry.gamesPlayed,
            metrics: JSON.stringify(entry.metrics),
          })
      )
      .execute();
  }

  async getScoreEntry(
    challengeType: string,
    strategyName: string,
    playerId: string
  ): Promise<ScoringEntry | undefined> {
    const row = await this.db
      .selectFrom("score_entries")
      .where("challenge_type", "=", challengeType)
      .where("strategy_name", "=", strategyName)
      .where("player_id", "=", playerId)
      .selectAll()
      .executeTakeFirst();

    if (!row) return undefined;
    return {
      playerId: row.player_id,
      gamesPlayed: row.games_played,
      metrics: JSON.parse(row.metrics),
    };
  }

  async setGlobalScoreEntry(entry: ScoringEntry): Promise<void> {
    await this.db
      .insertInto("global_score_entries")
      .values({
        player_id: entry.playerId,
        games_played: entry.gamesPlayed,
        metrics: JSON.stringify(entry.metrics),
      })
      .onConflict((oc) =>
        oc.column("player_id").doUpdateSet({
          games_played: entry.gamesPlayed,
          metrics: JSON.stringify(entry.metrics),
        })
      )
      .execute();
  }

  async getGlobalScoreEntry(
    playerId: string
  ): Promise<ScoringEntry | undefined> {
    const row = await this.db
      .selectFrom("global_score_entries")
      .where("player_id", "=", playerId)
      .selectAll()
      .executeTakeFirst();

    if (!row) return undefined;
    return {
      playerId: row.player_id,
      gamesPlayed: row.games_played,
      metrics: JSON.parse(row.metrics),
    };
  }
}
