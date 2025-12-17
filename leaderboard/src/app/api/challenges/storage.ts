import { v4 as uuidv4 } from 'uuid';
import { Challenge } from '@/app/_shared/types';
import { PsiChallenge } from '@/app/_challenges/psi';
// Shared storage for challenges

// Map: challengeId -> Challenge
export const challenges = new Map<string, Challenge>();

export function createChallenge(challengeType: string): Challenge {
  const id = crypto.randomUUID();

  if (challengeType === "psi") {
    const psiChallenge = new PsiChallenge({
      challengeId: id,
      players: 2,
      range: [100, 900],
      intersectionSize: 3,
      setSize: 10,
    });

    const challenge: Challenge = {
      id,
      name: challengeType,
      createdAt: Date.now(),
      challengeType,
      invites: ["inv_" + uuidv4(), "inv_" + uuidv4()],
      instance: psiChallenge,
    };
    challenges.set(id, challenge);
    return challenge;
  }

  throw new Error(`Unknown challenge type: ${challengeType}`);

}

export enum ChallengeError {
  NOT_FOUND = 'NOT_FOUND',
  INVITE_ALREADY_USED = 'INVITE_ALREADY_USED',
}

function isInviteFree(challenge: Challenge, invite: string): boolean {
  return !challenge.instance?.state?.players?.includes(invite);
}

export type Result<T, E = ChallengeError> =
  | { success: true; data: T }
  | { success: false; error: E; message: string };

  
export function filterValidInvites(invites: string[]): string[] {
  return []
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

