import type { GameResult, ScoringEntry } from "./types";

export class InMemoryScoringStore {
  /** challengeType → GameResult[] */
  private results = new Map<string, GameResult[]>();
  /** challengeType → strategyName → ScoringEntry[] */
  private scores = new Map<string, Map<string, ScoringEntry[]>>();
  /** global ScoringEntry[] */
  private globalScores: ScoringEntry[] = [];

  addResult(result: GameResult): void {
    const list = this.results.get(result.challengeType) ?? [];
    list.push(result);
    this.results.set(result.challengeType, list);
  }

  getResults(challengeType: string): GameResult[] {
    return this.results.get(challengeType) ?? [];
  }

  getAllResults(): GameResult[] {
    const all: GameResult[] = [];
    for (const list of this.results.values()) {
      all.push(...list);
    }
    return all;
  }

  getChallengeTypes(): string[] {
    return [...this.results.keys()];
  }

  setScores(challengeType: string, strategyName: string, entries: ScoringEntry[]): void {
    let strategies = this.scores.get(challengeType);
    if (!strategies) {
      strategies = new Map();
      this.scores.set(challengeType, strategies);
    }
    strategies.set(strategyName, entries);
  }

  getScores(challengeType: string): Record<string, ScoringEntry[]> {
    const strategies = this.scores.get(challengeType);
    if (!strategies) return {};
    return Object.fromEntries(strategies);
  }

  setGlobalScores(entries: ScoringEntry[]): void {
    this.globalScores = entries;
  }

  getGlobalScores(): ScoringEntry[] {
    return this.globalScores;
  }

  clear(): void {
    this.results.clear();
    this.scores.clear();
    this.globalScores = [];
  }
}
