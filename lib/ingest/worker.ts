import type { HazardEvent } from "@/lib/types";
import { getRepo } from "@/lib/db";
import { getUsgsEvents } from "@/lib/sources/usgs";
import { fetchGdacsLive } from "./gdacs";

export interface IngestResult {
  startedAt: string;
  finishedAt: string;
  sources: { source: string; count: number; ok: boolean; error?: string }[];
  totalUpserted: number;
}

/**
 * Run one ingest pass: pull live feeds and upsert normalized events into the
 * shared HazardEventRecord table. Safe to call concurrently (idempotent upserts).
 */
export async function runIngest(): Promise<IngestResult> {
  const repo = getRepo();
  const startedAt = new Date().toISOString();
  const sources: IngestResult["sources"] = [];
  let total = 0;

  // USGS — global, keyless
  try {
    const { events } = await getUsgsEvents();
    const n = await repo.upsertHazardEvents(events);
    sources.push({ source: "USGS", count: n, ok: true });
    total += n;
    await repo.recordIngestRun({ source: "USGS", count: n, ok: true, finishedAt: new Date().toISOString() });
  } catch (e: any) {
    sources.push({ source: "USGS", count: 0, ok: false, error: e.message });
    await repo.recordIngestRun({ source: "USGS", count: 0, ok: false, error: e.message, finishedAt: new Date().toISOString() });
  }

  // GDACS — global, keyless
  try {
    const events = await fetchGdacsLive();
    const n = await repo.upsertHazardEvents(events);
    sources.push({ source: "GDACS", count: n, ok: true });
    total += n;
    await repo.recordIngestRun({ source: "GDACS", count: n, ok: true, finishedAt: new Date().toISOString() });
  } catch (e: any) {
    sources.push({ source: "GDACS", count: 0, ok: false, error: e.message });
    await repo.recordIngestRun({ source: "GDACS", count: 0, ok: false, error: e.message, finishedAt: new Date().toISOString() });
  }

  // NASA FIRMS — only if key present (requires FIRMS_MAP_KEY). Ingest for a set
  // of region bboxes to keep the request bounded.
  if (process.env.FIRMS_MAP_KEY) {
    try {
      const { ingestFirmsRegions } = await import("./firms");
      const events = await ingestFirmsRegions();
      const n = await repo.upsertHazardEvents(events);
      sources.push({ source: "NASA_FIRMS", count: n, ok: true });
      total += n;
      await repo.recordIngestRun({ source: "NASA_FIRMS", count: n, ok: true, finishedAt: new Date().toISOString() });
    } catch (e: any) {
      sources.push({ source: "NASA_FIRMS", count: 0, ok: false, error: e.message });
      await repo.recordIngestRun({ source: "NASA_FIRMS", count: 0, ok: false, error: e.message, finishedAt: new Date().toISOString() });
    }
  }

  return { startedAt, finishedAt: new Date().toISOString(), sources, totalUpserted: total };
}

// Background loop state (single instance guard)
let started = false;

export function startIngestWorker() {
  if (started) return;
  started = true;
  const intervalMs = Number(process.env.INGEST_INTERVAL_MS) || 5 * 60 * 1000;
  const run = async () => {
    try {
      const r = await runIngest();
      console.log(`[ingest] pass complete: ${r.totalUpserted} events upserted from ${r.sources.length} source(s)`);
    } catch (e: any) {
      console.error("[ingest] pass failed:", e.message);
    }
  };
  // fire immediately, then on interval
  setTimeout(run, 3000);
  setInterval(run, intervalMs);
  console.log(`[ingest] background worker started (interval ${Math.round(intervalMs / 1000)}s)`);
}
