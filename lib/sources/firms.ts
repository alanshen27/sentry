import type { HazardEvent, SourceStatus } from "@/lib/types";
import { getCache } from "@/lib/cache";
import { loadDemo } from "./demo";

// FIRMS CSV area API: /api/area/csv/{MAP_KEY}/{west,south,east,north}/{days}
const FIRMS_URL = (key: string, bbox: number[], days = 2) =>
  `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/${bbox.join(",")}/${days}`;

function parseFirmsCsv(csv: string): HazardEvent[] {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map((h) => h.trim());
  const idx = (k: string) => header.indexOf(k);
  const out: HazardEvent[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (cols.length < header.length) continue;
    const lat = Number(cols[idx("latitude")]);
    const lng = Number(cols[idx("longitude")]);
    const frp = Number(cols[idx("frp")]);
    const bright = Number(cols[idx("bright_ti4")] || cols[idx("brightness")] || 0);
    const confRaw = String(cols[idx("confidence")]);
    const conf = confRaw === "h" ? 0.9 : confRaw === "n" ? 0.65 : 0.4;
    const acqDate = cols[idx("acq_date")];
    const acqTime = cols[idx("acq_time")].padStart(4, "0");
    const observedAt = new Date(`${acqDate}T${acqTime.slice(0, 2)}:${acqTime.slice(2, 4)}:00Z`).toISOString();
    out.push({
      id: `firms_${i}_${lat}_${lng}`,
      type: "wildfire",
      source: "NASA_FIRMS",
      geometry: { type: "Point", coordinates: [lng, lat] },
      severity: Math.min(100, Math.round((frp / 300) * 85 + 10)),
      confidence: conf,
      observedAt,
      properties: { brightness: bright, frp, satellite: cols[idx("satellite")], instrument: cols[idx("instrument")], confidenceRaw: confRaw },
    });
  }
  return out;
}

export async function getFirmsEvents(bbox?: number[]): Promise<{ events: HazardEvent[]; status: SourceStatus }> {
  const key = process.env.FIRMS_MAP_KEY;
  const cache = getCache();
  const cacheKey = `firms:${bbox ? bbox.join(",") : "global"}`;

  if (key && bbox) {
    try {
      const cached = await cache.get<HazardEvent[]>(cacheKey);
      if (cached) return { events: cached, status: mkStatus("connected", key) };
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(FIRMS_URL(key, bbox, 2), { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error(`FIRMS ${res.status}`);
      const csv = await res.text();
      const events = parseFirmsCsv(csv);
      await cache.set(cacheKey, events, 600);
      return { events, status: mkStatus("connected", key) };
    } catch (e: any) {
      const events = await loadDemo<HazardEvent[]>("firms_somalia_kenya.json");
      return { events, status: { ...mkStatus("cached_fallback", key), detail: e.message } };
    }
  }

  const events = await loadDemo<HazardEvent[]>("firms_somalia_kenya.json");
  return {
    events: bbox ? events.filter((e) => inBbox(e.geometry, bbox)) : events,
    status: key ? mkStatus("cached_fallback", key) : mkStatus("needs_api_key", key),
  };
}

function mkStatus(state: SourceStatus["state"], _key?: string): SourceStatus {
  return { id: "firms", name: "NASA FIRMS", state, lastUpdated: new Date().toISOString() };
}

function inBbox(g: GeoJSON.Geometry, bbox: number[]): boolean {
  if (g.type !== "Point") return false;
  const [lng, lat] = g.coordinates as [number, number];
  return lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3];
}
