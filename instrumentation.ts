export async function register() {
  // Only start the background ingest worker in the Node.js runtime (not edge).
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startIngestWorker } = await import("./lib/ingest/worker");
    startIngestWorker();
  }
}
