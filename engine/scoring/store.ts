import type { GameResult, ScoringEntry } from "./types";

export interface ScoringStorageAdapter {
  addResult(result: GameResult): Promise<void>;
  getResults(challengeType: string): Promise<GameResult[]>;
  getAllResults(): Promise<GameResult[]>;
  getChallengeTypes(): Promise<string[]>;
  setScores(challengeType: string, strategyName: string, entries: ScoringEntry[]): Promise<void>;
  getScores(challengeType: string): Promise<Record<string, ScoringEntry[]>>;
  setGlobalScores(entries: ScoringEntry[]): Promise<void>;
  getGlobalScores(): Promise<ScoringEntry[]>;
  clear(): Promise<void>;

  getStrategyState<T>(challengeType: string, strategyName: string, playerId: string): Promise<T | undefined>;
  setStrategyState<T>(challengeType: string, strategyName: string, playerId: string, state: T): Promise<void>;
  getGlobalStrategyState<T>(playerId: string): Promise<T | undefined>;
  setGlobalStrategyState<T>(playerId: string, state: T): Promise<void>;
  setScoreEntry(challengeType: string, strategyName: string, entry: ScoringEntry): Promise<void>;
  getScoreEntry(challengeType: string, strategyName: string, playerId: string): Promise<ScoringEntry | undefined>;
  setGlobalScoreEntry(entry: ScoringEntry): Promise<void>;
}

export class InMemoryScoringStore implements ScoringStorageAdapter {
  /** challengeType → GameResult[] */
  private results = new Map<string, GameResult[]>();
  /** challengeType → strategyName → playerId → ScoringEntry */
  private scores = new Map<string, Map<string, Map<string, ScoringEntry>>>();
  /** playerId → ScoringEntry */
  private globalScores = new Map<string, ScoringEntry>();
  /** "challengeType:strategyName" → playerId → state */
  private strategyState = new Map<string, Map<string, unknown>>();
  /** playerId → state */
  private globalStrategyState = new Map<string, unknown>();

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
    const playerMap = new Map<string, ScoringEntry>();
    for (const entry of entries) {
      playerMap.set(entry.playerId, entry);
    }
    strategies.set(strategyName, playerMap);
  }

  async getScores(challengeType: string): Promise<Record<string, ScoringEntry[]>> {
    const strategies = this.scores.get(challengeType);
    if (!strategies) return {};
    const result: Record<string, ScoringEntry[]> = {};
    for (const [name, playerMap] of strategies) {
      result[name] = [...playerMap.values()];
    }
    return result;
  }

  async setGlobalScores(entries: ScoringEntry[]): Promise<void> {
    this.globalScores.clear();
    for (const entry of entries) {
      this.globalScores.set(entry.playerId, entry);
    }
  }

  async getGlobalScores(): Promise<ScoringEntry[]> {
    return [...this.globalScores.values()];
  }

  async clear(): Promise<void> {
    this.results.clear();
    this.scores.clear();
    this.globalScores.clear();
    this.strategyState.clear();
    this.globalStrategyState.clear();
  }

  async getStrategyState<T>(challengeType: string, strategyName: string, playerId: string): Promise<T | undefined> {
    const key = `${challengeType}:${strategyName}`;
    return this.strategyState.get(key)?.get(playerId) as T | undefined;
  }

  async setStrategyState<T>(challengeType: string, strategyName: string, playerId: string, state: T): Promise<void> {
    const key = `${challengeType}:${strategyName}`;
    let playerMap = this.strategyState.get(key);
    if (!playerMap) {
      playerMap = new Map();
      this.strategyState.set(key, playerMap);
    }
    playerMap.set(playerId, state);
  }

  async getGlobalStrategyState<T>(playerId: string): Promise<T | undefined> {
    return this.globalStrategyState.get(playerId) as T | undefined;
  }

  async setGlobalStrategyState<T>(playerId: string, state: T): Promise<void> {
    this.globalStrategyState.set(playerId, state);
  }

  async setScoreEntry(challengeType: string, strategyName: string, entry: ScoringEntry): Promise<void> {
    let strategies = this.scores.get(challengeType);
    if (!strategies) {
      strategies = new Map();
      this.scores.set(challengeType, strategies);
    }
    let playerMap = strategies.get(strategyName);
    if (!playerMap) {
      playerMap = new Map();
      strategies.set(strategyName, playerMap);
    }
    playerMap.set(entry.playerId, entry);
  }

  async getScoreEntry(challengeType: string, strategyName: string, playerId: string): Promise<ScoringEntry | undefined> {
    return this.scores.get(challengeType)?.get(strategyName)?.get(playerId);
  }

  async setGlobalScoreEntry(entry: ScoringEntry): Promise<void> {
    this.globalScores.set(entry.playerId, entry);
  }
}
