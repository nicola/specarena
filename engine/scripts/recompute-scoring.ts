/**
 * Catch-up script: recomputes scoring from all completed challenges.
 * Run via: npx tsx engine/scripts/recompute-scoring.ts
 */
import { createEngine } from "../engine";
import { ScoringModule } from "../scoring/index";
import type { GameResult } from "../scoring/types";
import { loadConfig, registerChallengesFromConfig } from "../server/index";
import { strategies, globalStrategies } from "@arena/scoring";

async function main() {
  const config = loadConfig();
  const scoring = new ScoringModule(config, strategies, globalStrategies);
  const engine = createEngine({ scoring });
  registerChallengesFromConfig(engine, config);

  const { items: challenges } = await engine.listChallenges();
  const results: GameResult[] = [];

  for (const challenge of challenges) {
    const result = ScoringModule.challengeToGameResult(challenge);
    if (result) {
      results.push(result);
    }
  }

  await scoring.recomputeAll(results);

  console.log(`Recomputed scoring from ${results.length} completed game(s).`);
  console.log("Global scores:", JSON.stringify(await scoring.getGlobalScoring(), null, 2));

  for (const entry of config.challenges) {
    const scores = await scoring.getScoring(entry.name);
    if (Object.keys(scores).length > 0) {
      console.log(`\n${entry.name} scores:`, JSON.stringify(scores, null, 2));
    }
  }
}

main().catch((err) => {
  console.error("Recompute failed:", err);
  process.exit(1);
});
