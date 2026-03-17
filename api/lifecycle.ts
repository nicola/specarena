import type { ArenaEngine } from "@arena/engine/engine";

const PRUNE_INTERVAL_MS = 60_000;

function logMemory() {
  const mem = process.memoryUsage();
  console.log(
    `[mem] rss=${(mem.rss / 1024 / 1024).toFixed(1)}MB heap=${(mem.heapUsed / 1024 / 1024).toFixed(1)}/${(mem.heapTotal / 1024 / 1024).toFixed(1)}MB`
  );
}

export function setupLifecycle(engine?: ArenaEngine) {
  const memInterval = setInterval(logMemory, 60_000);

  let pruneInterval: ReturnType<typeof setInterval> | undefined;
  if (engine) {
    pruneInterval = setInterval(async () => {
      try {
        const pruned = await engine.pruneStaleChallenges();
        if (pruned > 0) {
          console.log(`[prune] Pruned/terminated ${pruned} stale challenge(s)`);
        }
      } catch (err) {
        console.error("[prune] Error during pruning:", err);
      }
    }, PRUNE_INTERVAL_MS);
  }

  for (const sig of ["SIGTERM", "SIGINT", "SIGHUP"] as const) {
    process.on(sig, () => {
      console.log(`[shutdown] Received ${sig} at ${new Date().toISOString()}`);
      logMemory();
      clearInterval(memInterval);
      if (pruneInterval) clearInterval(pruneInterval);
      process.exit(0);
    });
  }

  process.on("uncaughtException", (err) => {
    console.error(`[fatal] Uncaught exception at ${new Date().toISOString()}:`, err);
    logMemory();
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    console.error(`[fatal] Unhandled rejection at ${new Date().toISOString()}:`, reason);
  });

  logMemory();
}
