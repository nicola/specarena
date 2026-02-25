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
  private async updateChallenge(result: GameResult): Promise<void> {
    const strategyNames = this.getStrategiesForChallenge(result.challengeType);

    for (const name of strategyNames) {
      const strategy = this.strategies[name];
      if (!strategy) continue;
      await strategy.update(result, this.store);
    }
  }

  /** Incrementally update global scores for a single game result. */
  private async updateGlobal(result: GameResult): Promise<void> {
    const globalName = this.config.scoring.global;
    if (!globalName) return;

    const globalStrategy = this.globalStrategies[globalName];
    if (!globalStrategy) return;

    // Use the first per-challenge strategy as the representative for global aggregation
    const strategyNames = this.getStrategiesForChallenge(result.challengeType);
    const firstStrategy = strategyNames[0];
    if (!firstStrategy) return;

    await globalStrategy.update(result, this.store, firstStrategy);
  }

  /** Returns true if any player userId appears more than once (self-play). */
  private static isSelfPlay(result: GameResult): boolean {
    const userIds = result.players.map((p) => result.playerIdentities[p]).filter(Boolean);
    return new Set(userIds).size < userIds.length;
  }

  /** Record a game result and incrementally update scores. Called at game end. */
  async recordGame(result: GameResult): Promise<void> {
    if (ScoringModule.isSelfPlay(result)) return;
    await this.updateChallenge(result);
    await this.updateGlobal(result);
  }

  /** Catch-up: clear store and recompute from all provided results. */
  async recomputeAll(results: GameResult[]): Promise<void> {
    await this.store.clear();
    for (const result of results) {
      if (ScoringModule.isSelfPlay(result)) continue;
      await this.updateChallenge(result);
      await this.updateGlobal(result);
    }
  }

  /** Get per-challenge scores (all strategies). */
  async getScoring(challengeType: string): Promise<Record<string, ScoringEntry[]>> {
    return this.store.getScores(challengeType);
  }

  /** Get global scores. */
  async getGlobalScoring(): Promise<ScoringEntry[]> {
    return this.store.getGlobalScores();
  }

  /** Convert a completed Challenge to a GameResult. Returns null if game hasn't ended. */
  static challengeToGameResult(challenge: Challenge): GameResult | null {
    const state = challenge.instance?.state;
    if (!state?.gameEnded) return null;

    return {
      gameId: challenge.id,
      challengeType: challenge.challengeType,
      completedAt: challenge.createdAt,
      scores: state.scores,
      players: state.players,
      playerIdentities: state.playerIdentities,
    };
  }
}

export type { GameResult, ScoringEntry, ScoringStrategy, GlobalScoringStrategy, EngineConfig, ScoringConfig, ChallengeConfigEntry } from "./types";
export type { ScoringStorageAdapter } from "./store";
export { InMemoryScoringStore } from "./store";
