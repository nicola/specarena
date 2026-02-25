import type { ScoringEntry } from "./types";

/**
 * Strategies perform read-modify-write on state (getStrategyState → compute → setStrategyState).
 * A DB-backed adapter must serialize concurrent updates per (challengeType, strategyName, playerId)
 * to avoid lost updates — e.g. row-level locking or compare-and-swap.
 */
export interface ScoringStorageAdapter {
  getScores(challengeType: string): Promise<Record<string, ScoringEntry[]>>;
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
  /** challengeType → strategyName → playerId → ScoringEntry */
  private scores = new Map<string, Map<string, Map<string, ScoringEntry>>>();
  /** playerId → ScoringEntry */
  private globalScores = new Map<string, ScoringEntry>();
  /** "challengeType:strategyName" → playerId → state */
  private strategyState = new Map<string, Map<string, unknown>>();
  /** playerId → state */
  private globalStrategyState = new Map<string, unknown>();

  async getScores(challengeType: string): Promise<Record<string, ScoringEntry[]>> {
    const strategies = this.scores.get(challengeType);
    if (!strategies) return {};
    const result: Record<string, ScoringEntry[]> = {};
    for (const [name, playerMap] of strategies) {
      result[name] = [...playerMap.values()];
    }
    return result;
  }

  async getGlobalScores(): Promise<ScoringEntry[]> {
    return [...this.globalScores.values()];
  }

  async clear(): Promise<void> {
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
