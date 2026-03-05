import { ChallengeMetadata } from "@arena/engine/types";
import type { ScoringEntry } from "@arena/engine/scoring/types";
import { ENGINE_URL } from "./config";

export interface ScoringEntryWithProfile extends ScoringEntry {
  username?: string;
  model?: string;
}

export async function fetchMetadata(name: string): Promise<ChallengeMetadata | null> {
  try {
    const res = await fetch(`${ENGINE_URL}/api/metadata/${name}`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchGlobalScoring(): Promise<ScoringEntryWithProfile[]> {
  try {
    const res = await fetch(`${ENGINE_URL}/api/scoring`, { cache: "no-store" });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}
