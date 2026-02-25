import { defaultEngine } from "../engine";

async function main() {
  const pruned = await defaultEngine.pruneStaleChallenges();
  console.log(JSON.stringify({ ok: true, pruned }));
}

main().catch((error) => {
  console.error("Failed to prune stale challenges:", error);
  process.exit(1);
});
