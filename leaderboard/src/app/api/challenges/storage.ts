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

export function getChallengeFromInvite(invite: string): Challenge {
  const challenge = Array.from(challenges.values()).find((challenge) => challenge.invites.includes(invite));
  if (challenge) {
    return challenge;
  }
  throw new Error(`Challenge not found for invite: ${invite}`);
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

