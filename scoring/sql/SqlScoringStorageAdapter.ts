import type { Kysely } from "kysely";
import type { ScoringEntry, ScoringStorageAdapter } from "../types";

// Minimal table types needed (avoid circular dep on engine schema)
interface ScoringMetricsTable {
  challenge_type: string;
  strategy_name: string;
  player_id: string;
  metric_key: string;
  value: number;
}

interface ScoringStrategyStateTable {
  challenge_type: string;
  strategy_name: string;
  player_id: string;
  state: unknown;
}

interface ScoringDatabase {
  scoring_metrics: ScoringMetricsTable;
  scoring_strategy_state: ScoringStrategyStateTable;
}

const GLOBAL_CHALLENGE_TYPE = "__global__";
const GLOBAL_STRATEGY_NAME = "__global__";

export class SqlScoringStorageAdapter implements ScoringStorageAdapter {
  constructor(private readonly db: Kysely<ScoringDatabase>) {}

  async getScores(challengeType: string): Promise<Record<string, ScoringEntry[]>> {
    const rows = await this.db
      .selectFrom("scoring_metrics")
      .selectAll()
      .where("challenge_type", "=", challengeType)
      .execute();

    return this.groupMetricRows(rows);
  }

  async getGlobalScores(): Promise<ScoringEntry[]> {
    const rows = await this.db
      .selectFrom("scoring_metrics")
      .selectAll()
      .where("challenge_type", "=", GLOBAL_CHALLENGE_TYPE)
      .execute();

    const grouped = this.groupMetricRows(rows);
    return grouped[GLOBAL_STRATEGY_NAME] ?? [];
  }

  async clear(): Promise<void> {
    await this.db.deleteFrom("scoring_metrics").execute();
    await this.db.deleteFrom("scoring_strategy_state").execute();
  }

  async transaction<T>(fn: (store: ScoringStorageAdapter) => Promise<T>): Promise<T> {
    return this.db.transaction().execute(async (tx) => {
      const txStore = new SqlScoringStorageAdapter(tx as unknown as Kysely<ScoringDatabase>);
      return fn(txStore);
    });
  }

  async waitForIdle(): Promise<void> {
    // No-op for SQL — transactions are synchronous
  }

  async getStrategyState<T>(challengeType: string, strategyName: string, playerId: string): Promise<T | undefined> {
    const row = await this.db
      .selectFrom("scoring_strategy_state")
      .select("state")
      .where("challenge_type", "=", challengeType)
      .where("strategy_name", "=", strategyName)
      .where("player_id", "=", playerId)
      .executeTakeFirst();

    return row?.state as T | undefined;
  }

  async setStrategyState<T>(challengeType: string, strategyName: string, playerId: string, state: T): Promise<void> {
    await this.db
      .insertInto("scoring_strategy_state")
      .values({
        challenge_type: challengeType,
        strategy_name: strategyName,
        player_id: playerId,
        state: JSON.stringify(state) as any,
      })
      .onConflict((oc) =>
        oc.columns(["challenge_type", "strategy_name", "player_id"]).doUpdateSet({
          state: JSON.stringify(state) as any,
        }),
      )
      .execute();
  }

  async getGlobalStrategyState<T>(playerId: string): Promise<T | undefined> {
    return this.getStrategyState<T>(GLOBAL_CHALLENGE_TYPE, GLOBAL_STRATEGY_NAME, playerId);
  }

  async setGlobalStrategyState<T>(playerId: string, state: T): Promise<void> {
    return this.setStrategyState(GLOBAL_CHALLENGE_TYPE, GLOBAL_STRATEGY_NAME, playerId, state);
  }

  async setScoreEntry(challengeType: string, strategyName: string, entry: ScoringEntry): Promise<void> {
    await this.upsertMetrics(challengeType, strategyName, entry);
  }

  async getScoreEntry(challengeType: string, strategyName: string, playerId: string): Promise<ScoringEntry | undefined> {
    const rows = await this.db
      .selectFrom("scoring_metrics")
      .selectAll()
      .where("challenge_type", "=", challengeType)
      .where("strategy_name", "=", strategyName)
      .where("player_id", "=", playerId)
      .execute();

    if (rows.length === 0) return undefined;
    return this.rowsToEntry(playerId, rows);
  }

  async setGlobalScoreEntry(entry: ScoringEntry): Promise<void> {
    await this.upsertMetrics(GLOBAL_CHALLENGE_TYPE, GLOBAL_STRATEGY_NAME, entry);
  }

  async getGlobalScoreEntry(playerId: string): Promise<ScoringEntry | undefined> {
    return this.getScoreEntry(GLOBAL_CHALLENGE_TYPE, GLOBAL_STRATEGY_NAME, playerId);
  }

  // ── helpers ─────────────────────────────────────────────────────

  private async upsertMetrics(challengeType: string, strategyName: string, entry: ScoringEntry): Promise<void> {
    const allMetrics = { ...entry.metrics, "gameplayed:count": entry.gamesPlayed };

    for (const [metricKey, value] of Object.entries(allMetrics)) {
      await this.db
        .insertInto("scoring_metrics")
        .values({
          challenge_type: challengeType,
          strategy_name: strategyName,
          player_id: entry.playerId,
          metric_key: metricKey,
          value,
        })
        .onConflict((oc) =>
          oc
            .columns(["challenge_type", "strategy_name", "player_id", "metric_key"])
            .doUpdateSet({ value }),
        )
        .execute();
    }
  }

  private groupMetricRows(
    rows: { challenge_type: string; strategy_name: string; player_id: string; metric_key: string; value: number }[],
  ): Record<string, ScoringEntry[]> {
    // strategy → playerId → metrics
    const map = new Map<string, Map<string, { gamesPlayed: number; metrics: Record<string, number> }>>();

    for (const row of rows) {
      let stratMap = map.get(row.strategy_name);
      if (!stratMap) {
        stratMap = new Map();
        map.set(row.strategy_name, stratMap);
      }
      let entry = stratMap.get(row.player_id);
      if (!entry) {
        entry = { gamesPlayed: 0, metrics: {} };
        stratMap.set(row.player_id, entry);
      }
      if (row.metric_key === "gameplayed:count") {
        entry.gamesPlayed = row.value;
      } else {
        entry.metrics[row.metric_key] = row.value;
      }
    }

    const result: Record<string, ScoringEntry[]> = {};
    for (const [stratName, playerMap] of map) {
      result[stratName] = [];
      for (const [playerId, data] of playerMap) {
        result[stratName].push({
          playerId,
          gamesPlayed: data.gamesPlayed,
          metrics: data.metrics,
        });
      }
    }
    return result;
  }

  private rowsToEntry(
    playerId: string,
    rows: { metric_key: string; value: number }[],
  ): ScoringEntry {
    let gamesPlayed = 0;
    const metrics: Record<string, number> = {};
    for (const row of rows) {
      if (row.metric_key === "gameplayed:count") {
        gamesPlayed = row.value;
      } else {
        metrics[row.metric_key] = row.value;
      }
    }
    return { playerId, gamesPlayed, metrics };
  }
}
