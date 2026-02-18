import { v4 as uuidv4 } from 'uuid';
import { Challenge, ChallengeError, ChallengeFactory, ChallengeMetadata, Result } from '../types';
export { ChallengeError } from '../types';

// Challenge operator factories - populated by the host application
const challengeFactories = new Map<string, ChallengeFactory>();

// Challenge options - populated by the host application
const challengeOptions = new Map<string, Record<string, unknown>>();

// Challenge metadata - populated by the host application
const challengeMetadataMap = new Map<string, ChallengeMetadata>();

export function registerChallengeFactory(type: string, factory: ChallengeFactory, options?: Record<string, unknown>): void {
  challengeFactories.set(type, factory);
  if (options) {
    challengeOptions.set(type, options);
  }
}

export function registerChallengeMetadata(type: string, metadata: ChallengeMetadata): void {
  challengeMetadataMap.set(type, metadata);
}

export function getChallengeMetadata(name: string): ChallengeMetadata | undefined {
  return challengeMetadataMap.get(name);
}

export function getAllChallengeMetadata(): Record<string, ChallengeMetadata> {
  return Object.fromEntries(challengeMetadataMap);
}

// Map: challengeId -> Challenge
export const challenges = new Map<string, Challenge>();

export function createChallenge(challengeType: string): Challenge {
  const id = crypto.randomUUID();
  const factory = challengeFactories.get(challengeType);

  if (!factory) {
    throw new Error(`Unknown challenge type: ${challengeType}`);
  }

  const options = challengeOptions.get(challengeType);
  const instance = factory(id, options);

  const challenge: Challenge = {
    id,
    name: challengeType,
    createdAt: Date.now(),
    challengeType,
    invites: ["inv_" + uuidv4(), "inv_" + uuidv4()],
    instance,
  };
  challenges.set(id, challenge);
  return challenge;
}

function isInviteFree(challenge: Challenge, invite: string): boolean {
  return !challenge.instance?.state?.players?.includes(invite);
}

export function filterValidInvites(invites: string[]): string[] {
  return [];
}

export function getInvite(invite: string): Result<Challenge> {
  const result = getChallengeFromInvite(invite);
  if (!result.success) {
    return result;
  }
  if (!isInviteFree(result.data, invite)) {
    return {
      success: false,
      error: ChallengeError.INVITE_ALREADY_USED,
      message: `Invite already used: ${invite}`
    };
  }
  return result;
}

export function getChallengeFromInvite(invite: string): Result<Challenge> {
  const challenge = Array.from(challenges.values()).find((challenge) => challenge.invites.includes(invite));
  if (challenge) {
    return { success: true, data: challenge };
  }
  return {
    success: false,
    error: ChallengeError.NOT_FOUND,
    message: `Challenge not found for invite: ${invite}`
  };
}

export function getChallenge(challengeId: string): Challenge | undefined {
  return challenges.get(challengeId);
}

export function getChallengesByType(challengeType: string): Challenge[] {
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
  return Array.from(challenges.values())
    .filter(c => c.challengeType === challengeType)
    .filter(c => {
      const gameStarted = c.instance?.state?.gameStarted ?? false;
      const createdMoreThan10MinsAgo = c.createdAt < tenMinutesAgo;
      // Filter out challenges that are not started AND created more than 10 mins ago
      return gameStarted || !createdMoreThan10MinsAgo;
    })
    .sort((a, b) => b.createdAt - a.createdAt); // Sort by newest first
}
