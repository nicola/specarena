import type {
  EngineConfig,
  GameResult,
  ScoringEntry,
  ScoringStrategy,
  GlobalScoringStrategy,
} from "./types";
import type { ScoringStorageAdapter } from "./store";
import { InMemoryScoringStore } from "./store";
import type { Challenge } from "../types";

export class ScoringModule {
  private readonly config: EngineConfig;
  private readonly strategies: Record<string, ScoringStrategy>;
  private readonly globalStrategies: Record<string, GlobalScoringStrategy>;
  private readonly store: ScoringStorageAdapter;

  constructor(
    config: EngineConfig,
    strategies: Record<string, ScoringStrategy>,
    globalStrategies: Record<string, GlobalScoringStrategy>,
    storageAdapter?: ScoringStorageAdapter,
  ) {
    this.config = config;
    this.strategies = strategies;
    this.globalStrategies = globalStrategies;
    this.store = storageAdapter ?? new InMemoryScoringStore();
  }

  /** Get the merged list of strategy names for a given challenge type. */
  private getStrategiesForChallenge(challengeType: string): string[] {
    const defaults = this.config.scoring.default ?? [];
    const challengeConfig = this.config.challenges.find((c) => c.name === challengeType);
    const challengeScoring = challengeConfig?.scoring ?? [];
    return [...new Set([...defaults, ...challengeScoring])];
  }

  /** Incrementally update per-challenge scores for a single game result. */
  private async updateChallenge(result: GameResult, store: ScoringStorageAdapter): Promise<void> {
    const strategyNames = this.getStrategiesForChallenge(result.challengeType);

    for (const name of strategyNames) {
      const strategy = this.strategies[name];
      if (!strategy) continue;
      await strategy.update(result, store);
    }
  }

  /** Incrementally update global scores for a single game result. */
  private async updateGlobal(result: GameResult, store: ScoringStorageAdapter): Promise<void> {
    const globalName = this.config.scoring.global;
    if (!globalName) return;

    const globalStrategy = this.globalStrategies[globalName];
    if (!globalStrategy) return;

    const source = this.config.scoring.globalSource ?? this.config.scoring.default[0];
    if (!source) return;

    await globalStrategy.update(result, store, source);
  }

  /** Returns true if any player userId appears more than once (self-play). */
  private static isSelfPlay(result: GameResult): boolean {
    const userIds = result.players.map((p) => result.playerIdentities[p]).filter(Boolean);
    return new Set(userIds).size < userIds.length;
  }

  /** Record a game result and incrementally update scores. Called at game end. */
  async recordGame(result: GameResult): Promise<void> {
    return this.store.transaction(async (tx) => {
      if (ScoringModule.isSelfPlay(result)) return;
      await this.updateChallenge(result, tx);
      await this.updateGlobal(result, tx);
    });
  }

  /** Catch-up: clear store and recompute from all provided results. */
  async recomputeAll(results: GameResult[]): Promise<void> {
    return this.store.transaction(async (tx) => {
      await tx.clear();
      for (const result of results) {
        if (ScoringModule.isSelfPlay(result)) continue;
        await this.updateChallenge(result, tx);
        await this.updateGlobal(result, tx);
      }
    });
  }

  /** Wait for all queued scoring work to finish. */
  async waitForIdle(): Promise<void> {
    await this.store.waitForIdle();
  }

  /** Get per-challenge scores (all strategies). */
  async getScoring(challengeType: string): Promise<Record<string, ScoringEntry[]>> {
    await this.store.waitForIdle();
    return this.store.getScores(challengeType);
  }

  /** Get global scores. */
  async getGlobalScoring(): Promise<ScoringEntry[]> {
    await this.store.waitForIdle();
    return this.store.getGlobalScores();
  }

  /** Convert a completed Challenge to a GameResult. Returns null if game hasn't ended. */
  static challengeToGameResult(challenge: Challenge): GameResult | null {
    const state = challenge.instance?.state;
    if (!state?.gameEnded) return null;

    return {
      gameId: challenge.id,
      challengeType: challenge.challengeType,
      createdAt: challenge.createdAt,
      completedAt: state.completedAt ?? Date.now(),
      scores: state.scores,
      players: state.players,
      playerIdentities: state.playerIdentities,
    };
  }
}

export type { GameResult, ScoringEntry, ScoringStrategy, GlobalScoringStrategy, EngineConfig, ScoringConfig, ChallengeConfigEntry } from "./types";
export type { ScoringStorageAdapter } from "./store";
export { InMemoryScoringStore } from "./store";
