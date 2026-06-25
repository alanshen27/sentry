import type { HazardEvent, SourceStatus } from "@/lib/types";
import { getCache } from "@/lib/cache";
import { loadDemo } from "./demo";

const USGS_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson";

export async function getUsgsEvents(): Promise<{ events: HazardEvent[]; status: SourceStatus }> {
  const cache = getCache();
  try {
    const cached = await cache.get<HazardEvent[]>("usgs:all_day");
    if (cached) return { events: cached, status: mkStatus("connected") };
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(USGS_URL, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error(`USGS ${res.status}`);
    const geo = await res.json();
    const events: HazardEvent[] = (geo.features ?? []).map((f: any) => {
      const mag = f.properties.mag ?? 0;
      return {
        id: `usgs_${f.id}`,
        type: "earthquake" as const,
        source: "USGS",
        geometry: f.geometry,
        severity: Math.min(100, Math.round((Math.max(0, mag) / 7) * 100)),
        confidence: 0.95,
        observedAt: new Date(f.properties.time).toISOString(),
        properties: { magnitude: mag, depthKm: f.geometry.coordinates[2], place: f.properties.place, url: f.properties.url },
      };
    });
    await cache.set("usgs:all_day", events, 600);
    return { events, status: mkStatus("connected") };
  } catch (e: any) {
    const events = await loadDemo<HazardEvent[]>("usgs_recent.json");
    return { events, status: { ...mkStatus("cached_fallback"), detail: e.message } };
  }
}

function mkStatus(state: SourceStatus["state"] = "connected"): SourceStatus {
  return { id: "usgs", name: "USGS Earthquakes", state, lastUpdated: new Date().toISOString() };
}
