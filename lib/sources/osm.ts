import type { CriticalFacility, SourceStatus } from "@/lib/types";
import { getCache } from "@/lib/cache";
import { loadDemo } from "./demo";
import { demoDataAppliesToBbox, emptyOsm } from "@/lib/osm/clip";
import { fetchOhsomeExposure } from "./ohsome";

export interface OsmData {
  buildings: GeoJSON.FeatureCollection;
  roads: GeoJSON.FeatureCollection;
  facilities: GeoJSON.FeatureCollection;
}

const MEM_TTL_MS = 60 * 60 * 1000;
const FAIL_TTL_MS = 10 * 60 * 1000;

const memCache = new Map<string, { data: OsmData; expires: number }>();
const failUntil = new Map<string, number>();
const inFlight = new Map<string, Promise<{ data: OsmData; fallback: boolean; detail?: string }>>();

function snapBbox(bbox: number[]): number[] {
  const snap = (n: number) => Math.round(n * 100) / 100;
  return [snap(bbox[0]), snap(bbox[1]), snap(bbox[2]), snap(bbox[3])];
}

function cacheKey(bbox: number[], polygon?: GeoJSON.Polygon): string {
  const base = snapBbox(bbox).join(",");
  if (!polygon) return base;
  const ring = polygon.coordinates[0];
  const sig = ring.length > 0 ? `${ring[0][0]},${ring[0][1]}` : "poly";
  return `${base}|${ring.length}|${sig}`;
}

async function demoFallback(): Promise<OsmData> {
  const [buildings, roads, facilities] = await Promise.all([
    loadDemo<GeoJSON.FeatureCollection>("osm_buildings_sample.geojson"),
    loadDemo<GeoJSON.FeatureCollection>("osm_roads_sample.geojson"),
    loadDemo<GeoJSON.FeatureCollection>("critical_facilities_sample.geojson"),
  ]);
  return { buildings, roads, facilities };
}

function readMem(key: string): OsmData | null {
  const row = memCache.get(key);
  if (!row || row.expires < Date.now()) {
    if (row) memCache.delete(key);
    return null;
  }
  return row.data;
}

function writeMem(key: string, data: OsmData, ttlMs = MEM_TTL_MS) {
  memCache.set(key, { data, expires: Date.now() + ttlMs });
}

async function resolveOsm(
  bbox: number[],
  polygon?: GeoJSON.Polygon,
): Promise<{ data: OsmData; fallback: boolean; detail?: string }> {
  const key = cacheKey(bbox, polygon);
  const snapped = snapBbox(bbox);

  const mem = readMem(key);
  if (mem) {
    const cooling = (failUntil.get(key) ?? 0) > Date.now();
    return { data: mem, fallback: cooling, detail: cooling ? "Exposure API cooling down — serving cached data" : undefined };
  }

  if ((failUntil.get(key) ?? 0) > Date.now()) {
    if (!demoDataAppliesToBbox(snapped)) {
      return { data: emptyOsm(), fallback: true, detail: "Exposure data unavailable — try a smaller region or retry later" };
    }
    const demo = await demoFallback();
    writeMem(key, demo, FAIL_TTL_MS);
    return { data: demo, fallback: true, detail: "Using demo exposure sample (East Africa)" };
  }

  const cache = getCache();
  const redisHit = await cache.get<OsmData>(`exposure:${key}`);
  if (redisHit) {
    writeMem(key, redisHit);
    return { data: redisHit, fallback: false };
  }

  try {
    const data = await fetchOhsomeExposure(snapped, polygon);
    writeMem(key, data);
    await cache.set(`exposure:${key}`, data, 3600);
    return { data, fallback: false };
  } catch (e: any) {
    failUntil.set(key, Date.now() + FAIL_TTL_MS);
    if (!demoDataAppliesToBbox(snapped)) {
      return { data: emptyOsm(), fallback: true, detail: e.message ?? "Exposure fetch failed" };
    }
    const demo = await demoFallback();
    writeMem(key, demo, FAIL_TTL_MS);
    return { data: demo, fallback: true, detail: e.message };
  }
}

/** Buildings, roads, and critical facilities for a region (via ohsome — not Overpass). */
export async function getOsm(
  bbox: number[],
  polygon?: GeoJSON.Polygon,
): Promise<{ data: OsmData; status: SourceStatus }> {
  const key = cacheKey(bbox, polygon);
  let pending = inFlight.get(key);
  if (!pending) {
    pending = resolveOsm(bbox, polygon);
    inFlight.set(key, pending);
    pending.finally(() => inFlight.delete(key));
  }
  const { data, fallback, detail } = await pending;
  return {
    data,
    status: fallback
      ? { ...mkStatus("cached_fallback"), detail: detail ?? "Using cached exposure data" }
      : mkStatus("connected"),
  };
}

export function facilityFromFeature(f: any): CriticalFacility | null {
  if (f.geometry.type !== "Point") return null;
  const t = f.properties?.type ?? f.properties?.amenity;
  const map: Record<string, CriticalFacility["type"]> = { hospital: "hospital", clinic: "clinic", school: "school", shelter: "shelter" };
  const type = map[t] ?? "water_point";
  return { id: f.properties?.id ?? String(f.id), type, name: f.properties?.name ?? type, geometry: f.geometry, tags: f.properties };
}

function mkStatus(state: SourceStatus["state"] = "connected"): SourceStatus {
  return { id: "osm", name: "OSM via ohsome", state, lastUpdated: new Date().toISOString() };
}
