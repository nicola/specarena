import Prando from "prando";
import crypto from "node:crypto";

const UNIQUE_SET_MAX_ATTEMPTS_MULTIPLIER = 100;
const RNG_SERVER_SECRET = process.env.ARENA_RNG_SECRET ?? crypto.randomBytes(32).toString("hex");
const RNG_CONTEXT_PREFIX = "arena:v1";

/**
 * Derive a non-public deterministic seed from server-held secret material.
 * This prevents clients from reconstructing challenge RNG state from public IDs.
 */
export function derivePrivateSeed(context: string): string {
  return crypto.createHmac("sha256", RNG_SERVER_SECRET)
    .update(`${RNG_CONTEXT_PREFIX}:${context}`)
    .digest("hex");
}

/**
 * Generates a deterministic random set of size `size` from a channel seed
 * using the Prando library for seeded random number generation.
 * @param channelSeed - The seed for deterministic random generation
 * @param size - The size of the set to generate
 * @param from - The minimum value (inclusive) in the range
 * @param to - The maximum value (inclusive) in the range
 */
export function generateRandomSetFromSeed(
  channelSeed: string,
  size: number,
  from: number,
  to: number
): Set<number> {
  const rng = new Prando(channelSeed);
  const result = new Set<number>();

  const rangeSize = to - from + 1;

  // Validate that the range is large enough
  if (rangeSize < size) {
    throw new Error(`Range [${from}, ${to}] is too small to generate ${size} unique values`);
  }

  let attempts = 0;
  const maxAttempts = size * UNIQUE_SET_MAX_ATTEMPTS_MULTIPLIER;

  while (result.size < size) {
    const randomValue = rng.nextInt(from, to);
    result.add(randomValue);
    attempts++;

    // Safety check to prevent infinite loops
    if (attempts > maxAttempts) {
      throw new Error(`Failed to generate set of size ${size} after ${attempts} attempts`);
    }
  }

  return result;
}
