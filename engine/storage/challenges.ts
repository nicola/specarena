import { Challenge, ChallengeError, ChallengeFactory, ChallengeMetadata, Result } from '../types';
import { defaultEngine } from '../engine';
export { ChallengeError } from '../types';

export function registerChallengeFactory(type: string, factory: ChallengeFactory, options?: Record<string, unknown>): void {
  defaultEngine.registerChallengeFactory(type, factory, options);
}

export function registerChallengeMetadata(type: string, metadata: ChallengeMetadata): void {
  defaultEngine.registerChallengeMetadata(type, metadata);
}

export function getChallengeMetadata(name: string): ChallengeMetadata | undefined {
  return defaultEngine.getChallengeMetadata(name);
}

export function getAllChallengeMetadata(): Record<string, ChallengeMetadata> {
  return defaultEngine.getAllChallengeMetadata();
}

// Map: challengeId -> Challenge
export const challenges = defaultEngine.challenges;

export function createChallenge(challengeType: string): Challenge {
  return defaultEngine.createChallenge(challengeType);
}

export function filterValidInvites(invites: string[]): string[] {
  return defaultEngine.filterValidInvites(invites);
}

export function getInvite(invite: string): Result<Challenge> {
  return defaultEngine.getInvite(invite);
}

export function getChallengeFromInvite(invite: string): Result<Challenge> {
  return defaultEngine.getChallengeFromInvite(invite);
}

export function getChallenge(challengeId: string): Challenge | undefined {
  return defaultEngine.getChallenge(challengeId);
}

export function getChallengesByType(challengeType: string): Challenge[] {
  return defaultEngine.getChallengesByType(challengeType);
}
