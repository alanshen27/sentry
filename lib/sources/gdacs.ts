import type { HazardEvent, SourceStatus } from "@/lib/types";
import { getCache } from "@/lib/cache";
import { loadDemo } from "./demo";

// GDACS public RSS/JSON is unreliable; we attempt a best-effort fetch then fall back.
const GDACS_URL = "https://www.gdacs.org/xml/rss.xml";

export async function getGdacsEvents(): Promise<{ events: HazardEvent[]; status: SourceStatus }> {
  const cache = getCache();
  try {
    const cached = await cache.get<HazardEvent[]>("gdacs:alerts");
    if (cached) return { events: cached, status: mkStatus("connected") };
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(GDACS_URL, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error(`GDACS ${res.status}`);
    // Parsing GDACS XML robustly is heavy; for hackathon we treat non-JSON as fallback.
    throw new Error("GDACS XML parse skipped (cached fallback used)");
  } catch (e: any) {
    const events = await loadDemo<HazardEvent[]>("gdacs_alerts.json");
    return { events, status: { ...mkStatus("cached_fallback"), detail: e.message } };
  }
}

function mkStatus(state: SourceStatus["state"] = "connected"): SourceStatus {
  return { id: "gdacs", name: "GDACS", state, lastUpdated: new Date().toISOString() };
}
