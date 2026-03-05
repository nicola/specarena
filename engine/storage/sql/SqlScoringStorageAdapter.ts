import type { Kysely } from "kysely";
import type { Database } from "./schema";
import type { ScoringEntry, ScoringStorageAdapter } from "@arena/scoring";

const SCOPE_CHALLENGE = "challenge";
const SCOPE_GLOBAL = "global";
const GLOBAL_STRATEGY_NAME = "_global";
const GAMES_PLAYED_METRIC = "games_played";
const GLOBAL_CHALLENGE_TYPE_MARKER = "__global__";

type Scope = typeof SCOPE_CHALLENGE | typeof SCOPE_GLOBAL;

function scopeForChallengeType(challengeType: string): Scope {
  return challengeType === "_global" ? SCOPE_GLOBAL : SCOPE_CHALLENGE;
}

function challengeTypeForScope(scope: Scope, challengeType: string): string {
  return scope === SCOPE_GLOBAL ? GLOBAL_CHALLENGE_TYPE_MARKER : challengeType;
}

export class SqlScoringStorageAdapter implements ScoringStorageAdapter {
  private transactionQueue: Promise<void> = Promise.resolve();
  private readonly isTransaction: boolean;

  constructor(private readonly db: Kysely<Database>, isTransaction = false) {
    this.isTransaction = isTransaction;
  }

  private async readEntries(scope: Scope, challengeType: string): Promise<Record<string, ScoringEntry[]>> {
    const rows = await this.db
      .selectFrom("scoring_metrics")
      .selectAll()
      .where("scope", "=", scope)
      .where("challenge_type", "=", challengeType)
      .execute();

    const grouped = new Map<string, Map<string, ScoringEntry>>();
    for (const row of rows) {
      let byPlayer = grouped.get(row.strategy_name);
      if (!byPlayer) {
        byPlayer = new Map();
        grouped.set(row.strategy_name, byPlayer);
      }
      let entry = byPlayer.get(row.player_id);
      if (!entry) {
        entry = { playerId: row.player_id, gamesPlayed: 0, metrics: {} };
        byPlayer.set(row.player_id, entry);
      }
      if (row.metric_key === GAMES_PLAYED_METRIC) {
        entry.gamesPlayed = row.metric_value;
      } else {
        entry.metrics[row.metric_key] = row.metric_value;
      }
    }

    const result: Record<string, ScoringEntry[]> = {};
    for (const [strategyName, byPlayer] of grouped) {
      result[strategyName] = [...byPlayer.values()];
    }
    return result;
  }

  async getScores(challengeType: string): Promise<Record<string, ScoringEntry[]>> {
    return this.readEntries(SCOPE_CHALLENGE, challengeType);
  }

  async getScoresForPlayer(playerId: string): Promise<Record<string, Record<string, ScoringEntry>>> {
    const rows = await this.db
      .selectFrom("scoring_metrics")
      .selectAll()
      .where("scope", "=", SCOPE_CHALLENGE)
      .where("player_id", "=", playerId)
      .execute();

    const result: Record<string, Record<string, ScoringEntry>> = {};
    for (const row of rows) {
      const challengeType = row.challenge_type;
      if (!challengeType) continue;
      if (!result[challengeType]) result[challengeType] = {};
      let entry = result[challengeType][row.strategy_name];
      if (!entry) {
        entry = { playerId, gamesPlayed: 0, metrics: {} };
        result[challengeType][row.strategy_name] = entry;
      }
      if (row.metric_key === GAMES_PLAYED_METRIC) {
        entry.gamesPlayed = row.metric_value;
      } else {
        entry.metrics[row.metric_key] = row.metric_value;
      }
    }
    return result;
  }

  async getGlobalScores(): Promise<ScoringEntry[]> {
    const byStrategy = await this.readEntries(SCOPE_GLOBAL, GLOBAL_CHALLENGE_TYPE_MARKER);
    return byStrategy[GLOBAL_STRATEGY_NAME] ?? [];
  }

  async clear(): Promise<void> {
    await this.db.deleteFrom("scoring_metrics").execute();
    await this.db.deleteFrom("scoring_strategy_state").execute();
  }

  async transaction<T>(fn: (store: ScoringStorageAdapter) => Promise<T>): Promise<T> {
    const run = this.transactionQueue.then(
      () =>
        this.db.transaction().execute((trx) =>
          fn(new SqlScoringStorageAdapter(trx as unknown as Kysely<Database>, true))
        ),
      () =>
        this.db.transaction().execute((trx) =>
          fn(new SqlScoringStorageAdapter(trx as unknown as Kysely<Database>, true))
        )
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

  async getStrategyState<T>(challengeType: string, strategyName: string, playerId: string): Promise<T | undefined> {
    const scope = scopeForChallengeType(challengeType);
    const scopeChallengeType = challengeTypeForScope(scope, challengeType);
    const row = await this.db
      .selectFrom("scoring_strategy_state")
      .select("state")
      .where("scope", "=", scope)
      .where("challenge_type", "=", scopeChallengeType)
      .where("strategy_name", "=", strategyName)
      .where("player_id", "=", playerId)
      .executeTakeFirst();
    return row ? (JSON.parse(row.state) as T) : undefined;
  }

  async setStrategyState<T>(challengeType: string, strategyName: string, playerId: string, state: T): Promise<void> {
    const scope = scopeForChallengeType(challengeType);
    const scopeChallengeType = challengeTypeForScope(scope, challengeType);
    await this.db
      .insertInto("scoring_strategy_state")
      .values({
        scope,
        challenge_type: scopeChallengeType,
        strategy_name: strategyName,
        player_id: playerId,
        state: JSON.stringify(state),
      })
      .onConflict((oc) =>
        oc.columns(["scope", "challenge_type", "strategy_name", "player_id"]).doUpdateSet({
          state: JSON.stringify(state),
        })
      )
      .execute();
  }

  async getGlobalStrategyState<T>(playerId: string): Promise<T | undefined> {
    return this.getStrategyState<T>("_global", GLOBAL_STRATEGY_NAME, playerId);
  }

  async setGlobalStrategyState<T>(playerId: string, state: T): Promise<void> {
    return this.setStrategyState<T>("_global", GLOBAL_STRATEGY_NAME, playerId, state);
  }

  async setScoreEntry(challengeType: string, strategyName: string, entry: ScoringEntry): Promise<void> {
    const scope = scopeForChallengeType(challengeType);
    const scopeChallengeType = challengeTypeForScope(scope, challengeType);
    const rows = [
      {
        scope,
        challenge_type: scopeChallengeType,
        strategy_name: strategyName,
        player_id: entry.playerId,
        metric_key: GAMES_PLAYED_METRIC,
        metric_value: entry.gamesPlayed,
      },
      ...Object.entries(entry.metrics).map(([metricKey, metricValue]) => ({
        scope,
        challenge_type: scopeChallengeType,
        strategy_name: strategyName,
        player_id: entry.playerId,
        metric_key: metricKey,
        metric_value: metricValue,
      })),
    ];

    const doWork = async (db: Kysely<Database>) => {
      await db
        .deleteFrom("scoring_metrics")
        .where("scope", "=", scope)
        .where("challenge_type", "=", scopeChallengeType)
        .where("strategy_name", "=", strategyName)
        .where("player_id", "=", entry.playerId)
        .execute();

      await db.insertInto("scoring_metrics").values(rows).execute();
    };

    if (this.isTransaction) {
      await doWork(this.db);
    } else {
      await this.db.transaction().execute((trx) => doWork(trx as unknown as Kysely<Database>));
    }
  }

  async getScoreEntry(challengeType: string, strategyName: string, playerId: string): Promise<ScoringEntry | undefined> {
    const scope = scopeForChallengeType(challengeType);
    const scopeChallengeType = challengeTypeForScope(scope, challengeType);
    const rows = await this.db
      .selectFrom("scoring_metrics")
      .selectAll()
      .where("scope", "=", scope)
      .where("challenge_type", "=", scopeChallengeType)
      .where("strategy_name", "=", strategyName)
      .where("player_id", "=", playerId)
      .execute();
    if (rows.length === 0) return undefined;

    const entry: ScoringEntry = { playerId, gamesPlayed: 0, metrics: {} };
    for (const row of rows) {
      if (row.metric_key === GAMES_PLAYED_METRIC) {
        entry.gamesPlayed = row.metric_value;
      } else {
        entry.metrics[row.metric_key] = row.metric_value;
      }
    }
    return entry;
  }

  async setGlobalScoreEntry(entry: ScoringEntry): Promise<void> {
    return this.setScoreEntry("_global", GLOBAL_STRATEGY_NAME, entry);
  }

  async getGlobalScoreEntry(playerId: string): Promise<ScoringEntry | undefined> {
    return this.getScoreEntry("_global", GLOBAL_STRATEGY_NAME, playerId);
  }
}
