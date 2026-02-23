import { Challenge, ChallengeOperatorState } from "../types";

export interface SerializedChallenge {
  id: string;
  name: string;
  createdAt: number;
  challengeType: string;
  invites: string[];
  operatorState: ChallengeOperatorState;
  gameState: unknown;
}

export interface ArenaStorageAdapter {
  clearRuntimeState(): Promise<void>;
  listChallenges(): Promise<Challenge[]>;
  getChallenge(challengeId: string): Promise<Challenge | undefined>;
  setChallenge(challenge: Challenge): Promise<void>;
  listSerializedChallenges?(): Promise<SerializedChallenge[]>;
}
