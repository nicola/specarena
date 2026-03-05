import { eq, and, sql } from "drizzle-orm";
import type { ScoringEntry, ScoringStorageAdapter } from "@arena/scoring";
import { scoringEntries } from "./schema";
import type { Db } from "./db";

const GLOBAL = "_global";

export class SqlScoringStorageAdapter implements ScoringStorageAdapter {
  private transactionQueue: Promise<void> = Promise.resolve();

  constructor(private readonly db: Db) {}

  async getScores(
    challengeType: string,
  ): Promise<Record<string, ScoringEntry[]>> {
    const rows = await this.db
      .select()
      .from(scoringEntries)
      .where(eq(scoringEntries.challengeType, challengeType));

    const result: Record<string, ScoringEntry[]> = {};
    for (const row of rows) {
      const entry: ScoringEntry = {
        playerId: row.playerId,
        gamesPlayed: row.gamesPlayed,
        metrics: row.metrics as Record<string, number>,
      };
      if (!result[row.strategyName]) result[row.strategyName] = [];
      result[row.strategyName].push(entry);
    }
    return result;
  }

  async getGlobalScores(): Promise<ScoringEntry[]> {
    const rows = await this.db
      .select()
      .from(scoringEntries)
      .where(
        and(
          eq(scoringEntries.challengeType, GLOBAL),
          eq(scoringEntries.strategyName, GLOBAL),
        ),
      );

    return rows.map((row) => ({
      playerId: row.playerId,
      gamesPlayed: row.gamesPlayed,
      metrics: row.metrics as Record<string, number>,
    }));
  }

  async clear(): Promise<void> {
    await this.db.delete(scoringEntries);
  }

  async transaction<T>(
    fn: (store: ScoringStorageAdapter) => Promise<T>,
  ): Promise<T> {
    const run = this.transactionQueue.then(
      () =>
        this.db.transaction(async (tx) => {
          const txAdapter = new SqlScoringStorageAdapter(
            tx as unknown as Db,
          );
          // Disable nested transaction queue — we're already inside a tx
          txAdapter.transactionQueue = Promise.resolve();
          return fn(txAdapter);
        }),
      () =>
        this.db.transaction(async (tx) => {
          const txAdapter = new SqlScoringStorageAdapter(
            tx as unknown as Db,
          );
          txAdapter.transactionQueue = Promise.resolve();
          return fn(txAdapter);
        }),
    );
    this.transactionQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async waitForIdle(): Promise<void> {
    await this.transactionQueue;
  }

  async getStrategyState<T>(
    challengeType: string,
    strategyName: string,
    playerId: string,
  ): Promise<T | undefined> {
    const row = await this.db
      .select({ state: scoringEntries.state })
      .from(scoringEntries)
      .where(
        and(
          eq(scoringEntries.challengeType, challengeType),
          eq(scoringEntries.strategyName, strategyName),
          eq(scoringEntries.playerId, playerId),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]);

    return row?.state as T | undefined;
  }

  async setStrategyState<T>(
    challengeType: string,
    strategyName: string,
    playerId: string,
    state: T,
  ): Promise<void> {
    await this.db
      .insert(scoringEntries)
      .values({
        challengeType,
        strategyName,
        playerId,
        gamesPlayed: 0,
        metrics: {},
        state,
      })
      .onConflictDoUpdate({
        target: [
          scoringEntries.challengeType,
          scoringEntries.strategyName,
          scoringEntries.playerId,
        ],
        set: { state },
      });
  }

  async getGlobalStrategyState<T>(playerId: string): Promise<T | undefined> {
    return this.getStrategyState<T>(GLOBAL, GLOBAL, playerId);
  }

  async setGlobalStrategyState<T>(playerId: string, state: T): Promise<void> {
    return this.setStrategyState<T>(GLOBAL, GLOBAL, playerId, state);
  }

  async setScoreEntry(
    challengeType: string,
    strategyName: string,
    entry: ScoringEntry,
  ): Promise<void> {
    await this.db
      .insert(scoringEntries)
      .values({
        challengeType,
        strategyName,
        playerId: entry.playerId,
        gamesPlayed: entry.gamesPlayed,
        metrics: entry.metrics,
      })
      .onConflictDoUpdate({
        target: [
          scoringEntries.challengeType,
          scoringEntries.strategyName,
          scoringEntries.playerId,
        ],
        set: {
          gamesPlayed: sql`excluded.games_played`,
          metrics: sql`excluded.metrics`,
        },
      });
  }

  async getScoreEntry(
    challengeType: string,
    strategyName: string,
    playerId: string,
  ): Promise<ScoringEntry | undefined> {
    const row = await this.db
      .select()
      .from(scoringEntries)
      .where(
        and(
          eq(scoringEntries.challengeType, challengeType),
          eq(scoringEntries.strategyName, strategyName),
          eq(scoringEntries.playerId, playerId),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]);

    if (!row) return undefined;
    return {
      playerId: row.playerId,
      gamesPlayed: row.gamesPlayed,
      metrics: row.metrics as Record<string, number>,
    };
  }

  async setGlobalScoreEntry(entry: ScoringEntry): Promise<void> {
    return this.setScoreEntry(GLOBAL, GLOBAL, entry);
  }

  async getGlobalScoreEntry(
    playerId: string,
  ): Promise<ScoringEntry | undefined> {
    return this.getScoreEntry(GLOBAL, GLOBAL, playerId);
  }
}
