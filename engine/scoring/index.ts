import type {
  EngineConfig,
  GameResult,
  ScoringEntry,
  ScoringStrategy,
  GlobalScoringStrategy,
} from "./types";
import { InMemoryScoringStore } from "./store";
import type { Challenge } from "../types";

export class ScoringModule {
  private readonly config: EngineConfig;
  private readonly strategies: Record<string, ScoringStrategy>;
  private readonly globalStrategies: Record<string, GlobalScoringStrategy>;
  private readonly store: InMemoryScoringStore;

  constructor(
    config: EngineConfig,
    strategies: Record<string, ScoringStrategy>,
    globalStrategies: Record<string, GlobalScoringStrategy>,
  ) {
    this.config = config;
    this.strategies = strategies;
    this.globalStrategies = globalStrategies;
    this.store = new InMemoryScoringStore();
  }

  /** Get the merged list of strategy names for a given challenge type. */
  private getStrategiesForChallenge(challengeType: string): string[] {
    const defaults = this.config.scoring.default ?? [];
    const challengeConfig = this.config.challenges.find((c) => c.name === challengeType);
    const challengeScoring = challengeConfig?.scoring ?? [];
    return [...new Set([...defaults, ...challengeScoring])];
  }

  /** Recompute scores for a single challenge type using all applicable strategies. */
  private async recomputeChallenge(challengeType: string): Promise<void> {
    const results = await this.store.getResults(challengeType);
    const strategyNames = this.getStrategiesForChallenge(challengeType);

    for (const name of strategyNames) {
      const strategy = this.strategies[name];
      if (!strategy) continue;
      const entries = strategy.compute(results);
      await this.store.setScores(challengeType, name, entries);
    }
  }

  /** Recompute global scores if a global strategy is configured. */
  private async recomputeGlobal(): Promise<void> {
    const globalName = this.config.scoring.global;
    if (!globalName) return;

    const globalStrategy = this.globalStrategies[globalName];
    if (!globalStrategy) return;

    // Use the first strategy's scores for each challenge type as input to global
    const perChallenge: Record<string, ScoringEntry[]> = {};
    for (const challengeType of await this.store.getChallengeTypes()) {
      const scores = await this.store.getScores(challengeType);
      const strategyNames = this.getStrategiesForChallenge(challengeType);
      // Use the first strategy's output as the representative for global aggregation
      const firstStrategy = strategyNames[0];
      if (firstStrategy && scores[firstStrategy]) {
        perChallenge[challengeType] = scores[firstStrategy];
      }
    }

    const globalEntries = globalStrategy.compute(perChallenge);
    await this.store.setGlobalScores(globalEntries);
  }

  /** Returns true if any player userId appears more than once (self-play). */
  private static isSelfPlay(result: GameResult): boolean {
    const userIds = result.players.map((p) => result.playerIdentities[p]).filter(Boolean);
    return new Set(userIds).size < userIds.length;
  }

  /** Record a game result and recompute scores. Called at game end. */
  async recordGame(result: GameResult): Promise<void> {
    if (ScoringModule.isSelfPlay(result)) return;
    await this.store.addResult(result);
    await this.recomputeChallenge(result.challengeType);
    await this.recomputeGlobal();
  }

  /** Catch-up: clear store and recompute from all provided results. */
  async recomputeAll(results: GameResult[]): Promise<void> {
    await this.store.clear();
    for (const result of results) {
      if (ScoringModule.isSelfPlay(result)) continue;
      await this.store.addResult(result);
    }
    for (const challengeType of await this.store.getChallengeTypes()) {
      await this.recomputeChallenge(challengeType);
    }
    await this.recomputeGlobal();
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
