import type { ScoringEntry, ScoringStorageAdapter, PlayerScores } from "./types";

export class InMemoryScoringStore implements ScoringStorageAdapter {
  /** challengeType → strategyName → playerId → ScoringEntry */
  private scores = new Map<string, Map<string, Map<string, ScoringEntry>>>();
  /** playerId → ScoringEntry */
  private globalScores = new Map<string, ScoringEntry>();
  /** "challengeType:strategyName" → playerId → state */
  private strategyState = new Map<string, Map<string, unknown>>();
  /** playerId → state */
  private globalStrategyState = new Map<string, unknown>();
  /** Serializes scoring write transactions. */
  private transactionQueue: Promise<void> = Promise.resolve();

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

  async transaction<T>(fn: (store: ScoringStorageAdapter) => Promise<T>): Promise<T> {
    const run = this.transactionQueue.then(() => fn(this), () => fn(this));
    this.transactionQueue = run.then(() => undefined, () => undefined);
    return run;
  }

  async waitForIdle(): Promise<void> {
    await this.transactionQueue;
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

  async getScoresForPlayer(playerId: string): Promise<PlayerScores> {
    const challenges: Record<string, Record<string, ScoringEntry>> = {};
    for (const [challengeType, strategies] of this.scores) {
      const strategyEntries: Record<string, ScoringEntry> = {};
      for (const [strategyName, playerMap] of strategies) {
        const entry = playerMap.get(playerId);
        if (entry) strategyEntries[strategyName] = entry;
      }
      if (Object.keys(strategyEntries).length > 0) {
        challenges[challengeType] = strategyEntries;
      }
    }
    const globalEntry = this.globalScores.get(playerId) ?? null;
    return { global: globalEntry, challenges };
  }
}
