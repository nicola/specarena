import type { GameResult, ScoringEntry } from "./types";

export class InMemoryScoringStore {
  /** challengeType → GameResult[] */
  private results = new Map<string, GameResult[]>();
  /** challengeType → strategyName → ScoringEntry[] */
  private scores = new Map<string, Map<string, ScoringEntry[]>>();
  /** global ScoringEntry[] */
  private globalScores: ScoringEntry[] = [];

  async addResult(result: GameResult): Promise<void> {
    const list = this.results.get(result.challengeType) ?? [];
    list.push(result);
    this.results.set(result.challengeType, list);
  }

  async getResults(challengeType: string): Promise<GameResult[]> {
    return this.results.get(challengeType) ?? [];
  }

  async getAllResults(): Promise<GameResult[]> {
    const all: GameResult[] = [];
    for (const list of this.results.values()) {
      all.push(...list);
    }
    return all;
  }

  async getChallengeTypes(): Promise<string[]> {
    return [...this.results.keys()];
  }

  async setScores(challengeType: string, strategyName: string, entries: ScoringEntry[]): Promise<void> {
    let strategies = this.scores.get(challengeType);
    if (!strategies) {
      strategies = new Map();
      this.scores.set(challengeType, strategies);
    }
    strategies.set(strategyName, entries);
  }

  async getScores(challengeType: string): Promise<Record<string, ScoringEntry[]>> {
    const strategies = this.scores.get(challengeType);
    if (!strategies) return {};
    return Object.fromEntries(strategies);
  }

  async setGlobalScores(entries: ScoringEntry[]): Promise<void> {
    this.globalScores = entries;
  }

  async getGlobalScores(): Promise<ScoringEntry[]> {
    return this.globalScores;
  }

  async clear(): Promise<void> {
    this.results.clear();
    this.scores.clear();
    this.globalScores = [];
  }
}
