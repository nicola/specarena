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
  private recomputeChallenge(challengeType: string): void {
    const results = this.store.getResults(challengeType);
    const strategyNames = this.getStrategiesForChallenge(challengeType);

    for (const name of strategyNames) {
      const strategy = this.strategies[name];
      if (!strategy) continue;
      const entries = strategy.compute(results);
      this.store.setScores(challengeType, name, entries);
    }
  }

  /** Recompute global scores if a global strategy is configured. */
  private recomputeGlobal(): void {
    const globalName = this.config.scoring.global;
    if (!globalName) return;

    const globalStrategy = this.globalStrategies[globalName];
    if (!globalStrategy) return;

    // Use the first strategy's scores for each challenge type as input to global
    const perChallenge: Record<string, ScoringEntry[]> = {};
    for (const challengeType of this.store.getChallengeTypes()) {
      const scores = this.store.getScores(challengeType);
      const strategyNames = this.getStrategiesForChallenge(challengeType);
      // Use the first strategy's output as the representative for global aggregation
      const firstStrategy = strategyNames[0];
      if (firstStrategy && scores[firstStrategy]) {
        perChallenge[challengeType] = scores[firstStrategy];
      }
    }

    const globalEntries = globalStrategy.compute(perChallenge);
    this.store.setGlobalScores(globalEntries);
  }

  /** Returns true if any player userId appears more than once (self-play). */
  private static isSelfPlay(result: GameResult): boolean {
    const userIds = result.players.map((p) => result.playerIdentities[p]).filter(Boolean);
    return new Set(userIds).size < userIds.length;
  }

  /** Record a game result and recompute scores. Called at game end. */
  recordGame(result: GameResult): void {
    if (ScoringModule.isSelfPlay(result)) return;
    this.store.addResult(result);
    this.recomputeChallenge(result.challengeType);
    this.recomputeGlobal();
  }

  /** Catch-up: clear store and recompute from all provided results. */
  recomputeAll(results: GameResult[]): void {
    this.store.clear();
    for (const result of results) {
      if (ScoringModule.isSelfPlay(result)) continue;
      this.store.addResult(result);
    }
    for (const challengeType of this.store.getChallengeTypes()) {
      this.recomputeChallenge(challengeType);
    }
    this.recomputeGlobal();
  }

  /** Get per-challenge scores (all strategies). */
  getScoring(challengeType: string): Record<string, ScoringEntry[]> {
    return this.store.getScores(challengeType);
  }

  /** Get global scores. */
  getGlobalScoring(): ScoringEntry[] {
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
