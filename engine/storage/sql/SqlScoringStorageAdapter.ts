import type { Kysely } from "kysely";
import type { Database } from "./schema";
import type { ScoringEntry, ScoringStorageAdapter } from "@arena/scoring";

const GLOBAL_CHALLENGE_TYPE = "_global";
const GLOBAL_STRATEGY_NAME = "_global";

export class SqlScoringStorageAdapter implements ScoringStorageAdapter {
  private transactionQueue: Promise<void> = Promise.resolve();
  private readonly isTransaction: boolean;

  constructor(private readonly db: Kysely<Database>, isTransaction = false) {
    this.isTransaction = isTransaction;
  }

  async getScores(
    challengeType: string
  ): Promise<Record<string, ScoringEntry[]>> {
    const rows = await this.db
      .selectFrom("score_metrics")
      .selectAll()
      .where("challenge_type", "=", challengeType)
      .execute();

    const result: Record<string, ScoringEntry[]> = {};
    // Group by (strategy_name, player_id)
    const grouped = new Map<string, Map<string, { gamesPlayed: number; metrics: Record<string, number> }>>();

    for (const row of rows) {
      let strategyMap = grouped.get(row.strategy_name);
      if (!strategyMap) {
        strategyMap = new Map();
        grouped.set(row.strategy_name, strategyMap);
      }
      let entry = strategyMap.get(row.player_id);
      if (!entry) {
        entry = { gamesPlayed: row.games_played, metrics: {} };
        strategyMap.set(row.player_id, entry);
      }
      entry.metrics[row.metric_key] = row.metric_value;
    }

    for (const [strategyName, playerMap] of grouped) {
      result[strategyName] = [];
      for (const [playerId, data] of playerMap) {
        result[strategyName].push({
          playerId,
          gamesPlayed: data.gamesPlayed,
          metrics: data.metrics,
        });
      }
    }

    return result;
  }

  async getGlobalScores(): Promise<ScoringEntry[]> {
    const byStrategy = await this.getScores(GLOBAL_CHALLENGE_TYPE);
    return byStrategy[GLOBAL_STRATEGY_NAME] ?? [];
  }

  async clear(): Promise<void> {
    await this.db.deleteFrom("score_metrics").execute();
    await this.db.deleteFrom("strategy_state").execute();
  }

  async transaction<T>(
    fn: (store: ScoringStorageAdapter) => Promise<T>
  ): Promise<T> {
    const run = this.transactionQueue.then(
      () =>
        this.db.transaction().execute(async (trx) => {
          const txAdapter = new SqlScoringStorageAdapter(trx as unknown as Kysely<Database>, true);
          return fn(txAdapter);
        }),
      () =>
        this.db.transaction().execute(async (trx) => {
          const txAdapter = new SqlScoringStorageAdapter(trx as unknown as Kysely<Database>, true);
          return fn(txAdapter);
        })
    );
    this.transactionQueue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  async waitForIdle(): Promise<void> {
    await this.transactionQueue;
  }

  async getStrategyState<T>(
    challengeType: string,
    strategyName: string,
    playerId: string
  ): Promise<T | undefined> {
    const row = await this.db
      .selectFrom("strategy_state")
      .select("state")
      .where("challenge_type", "=", challengeType)
      .where("strategy_name", "=", strategyName)
      .where("player_id", "=", playerId)
      .executeTakeFirst();
    return row ? (JSON.parse(row.state) as T) : undefined;
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
    return this.getStrategyState<T>(
      GLOBAL_CHALLENGE_TYPE,
      GLOBAL_STRATEGY_NAME,
      playerId
    );
  }

  async setGlobalStrategyState<T>(playerId: string, state: T): Promise<void> {
    return this.setStrategyState<T>(
      GLOBAL_CHALLENGE_TYPE,
      GLOBAL_STRATEGY_NAME,
      playerId,
      state
    );
  }

  async setScoreEntry(
    challengeType: string,
    strategyName: string,
    entry: ScoringEntry
  ): Promise<void> {
    const rows = Object.entries(entry.metrics).map(([key, value]) => ({
      challenge_type: challengeType,
      strategy_name: strategyName,
      player_id: entry.playerId,
      metric_key: key,
      metric_value: value,
      games_played: entry.gamesPlayed,
    }));

    // Delete + insert in a single transaction for atomicity.
    // When called from within transaction(), this.db is already a transaction
    // connection, so the nested transaction() call becomes a savepoint.
    const doWork = async (conn: Kysely<Database>) => {
      await conn
        .deleteFrom("score_metrics")
        .where("challenge_type", "=", challengeType)
        .where("strategy_name", "=", strategyName)
        .where("player_id", "=", entry.playerId)
        .execute();

      if (rows.length > 0) {
        await conn.insertInto("score_metrics").values(rows).execute();
      }
    };

    // If we're already inside a DB transaction (this.db is a Transaction),
    // just run directly. Otherwise wrap in a transaction.
    if (this.isTransaction) {
      await doWork(this.db);
    } else {
      await this.db.transaction().execute((trx) =>
        doWork(trx as unknown as Kysely<Database>)
      );
    }
  }

  async getScoreEntry(
    challengeType: string,
    strategyName: string,
    playerId: string
  ): Promise<ScoringEntry | undefined> {
    const rows = await this.db
      .selectFrom("score_metrics")
      .selectAll()
      .where("challenge_type", "=", challengeType)
      .where("strategy_name", "=", strategyName)
      .where("player_id", "=", playerId)
      .execute();

    if (rows.length === 0) return undefined;

    const metrics: Record<string, number> = {};
    for (const row of rows) {
      metrics[row.metric_key] = row.metric_value;
    }
    return {
      playerId,
      gamesPlayed: rows[0].games_played,
      metrics,
    };
  }

  async setGlobalScoreEntry(entry: ScoringEntry): Promise<void> {
    return this.setScoreEntry(
      GLOBAL_CHALLENGE_TYPE,
      GLOBAL_STRATEGY_NAME,
      entry
    );
  }

  async getGlobalScoreEntry(
    playerId: string
  ): Promise<ScoringEntry | undefined> {
    return this.getScoreEntry(
      GLOBAL_CHALLENGE_TYPE,
      GLOBAL_STRATEGY_NAME,
      playerId
    );
  }
}
