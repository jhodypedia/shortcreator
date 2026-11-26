export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  ) {
    const g = globalThis as unknown as { __shortGenWorkerStarted?: boolean };
    if (!g.__shortGenWorkerStarted) {
      g.__shortGenWorkerStarted = true;
      const { startQueueWorkerLoop } = await import("./lib/queue-worker");
      startQueueWorkerLoop();
    }
  }
}
