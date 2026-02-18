import { ChallengeFactory } from "@arena/engine/types";
import { createChallenge as createPsi } from "./psi";

// Registry of challenge factories
// To add a new challenge: import its factory and add an entry here
export const registry: Record<string, ChallengeFactory> = {
  psi: createPsi,
};
