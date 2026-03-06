import type {
  EngineConfig,
  GameResult,
  MetricDescriptor,
  PlayerScores,
  ScoringEntry,
  ScoringStrategy,
  GlobalScoringStrategy,
} from "./types";
import type { ScoringStorageAdapter } from "./store";
import { InMemoryScoringStore } from "./store";
import type { ChallengeRecord } from "../types";

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
    // Intentionally non-blocking: leaderboard reads may be slightly stale but avoid waiting behind write bursts.
    // If strict read-after-write is needed again, reintroduce `await this.store.waitForIdle()` here.
    return this.store.getScores(challengeType);
  }

  /** Get global scores. */
  async getGlobalScoring(): Promise<ScoringEntry[]> {
    // Intentionally non-blocking for the same eventual-consistency tradeoff as getScoring().
    return this.store.getGlobalScores();
  }

  /** Get all scores (global + per-challenge) for a single player. */
  async getScoringForPlayer(playerId: string): Promise<PlayerScores> {
    const challengeTypes = this.config.challenges.map((c) => c.name);

    const challenges: PlayerScores["challenges"] = {};
    for (const ct of challengeTypes) {
      const data = await this.store.getScores(ct);
      const filtered: Record<string, ScoringEntry> = {};
      for (const [strategy, entries] of Object.entries(data)) {
        const entry = entries.find((e) => e.playerId === playerId);
        if (entry) filtered[strategy] = entry;
      }
      if (Object.keys(filtered).length > 0) {
        challenges[ct] = filtered;
      }
    }

    const global = await this.store.getGlobalScoreEntry(playerId) ?? null;

    return { global, challenges };
  }

  /** Get metric descriptors for all registered strategies. */
  getMetricDescriptors(): { strategies: Record<string, MetricDescriptor[]>; global: Record<string, MetricDescriptor[]> } {
    const strategies: Record<string, MetricDescriptor[]> = {};
    for (const [name, strategy] of Object.entries(this.strategies)) {
      strategies[name] = strategy.metrics;
    }
    const global: Record<string, MetricDescriptor[]> = {};
    for (const [name, strategy] of Object.entries(this.globalStrategies)) {
      global[name] = strategy.metrics;
    }
    return { strategies, global };
  }

  /** Convert a completed ChallengeRecord to a GameResult. Returns null if game hasn't ended. */
  static challengeToGameResult(challenge: ChallengeRecord): GameResult | null {
    const state = challenge.state;
    if (!state?.gameEnded) return null;

    return {
      gameId: challenge.id,
      challengeType: challenge.challengeType,
      createdAt: challenge.createdAt,
      completedAt: state.completedAt ?? Date.now(),
      scores: state.scores,
      players: state.players,
      playerIdentities: state.playerIdentities,
      attributions: state.attributions,
    };
  }
}

export type { GameResult, PlayerScores, ScoringEntry, MetricDescriptor, ScoringStrategy, GlobalScoringStrategy, EngineConfig, ScoringConfig, ChallengeConfigEntry } from "./types";
export type { ScoringStorageAdapter } from "./store";
export { InMemoryScoringStore } from "./store";
