import { defaultEngine } from "@arena/engine/engine";

function logMemory() {
  const mem = process.memoryUsage();
  console.log(
    `[mem] rss=${(mem.rss / 1024 / 1024).toFixed(1)}MB heap=${(mem.heapUsed / 1024 / 1024).toFixed(1)}/${(mem.heapTotal / 1024 / 1024).toFixed(1)}MB`
  );
}

async function runGC() {
  const pruned = await defaultEngine.pruneStaleChallenges();
  if (pruned > 0) {
    console.log(`[gc] Pruned ${pruned} stale challenge(s)`);
  }
}

export function setupLifecycle() {
  const memInterval = setInterval(logMemory, 60_000);
  const gcInterval = setInterval(runGC, 300_000);

  for (const sig of ["SIGTERM", "SIGINT", "SIGHUP"] as const) {
    process.on(sig, () => {
      console.log(`[shutdown] Received ${sig} at ${new Date().toISOString()}`);
      logMemory();
      clearInterval(memInterval);
      clearInterval(gcInterval);
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
