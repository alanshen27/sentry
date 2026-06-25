import type { HazardEvent, SourceStatus } from "@/lib/types";
import { getFirmsEvents } from "./firms";
import { getUsgsEvents } from "./usgs";
import { getGdacsEvents } from "./gdacs";
import { getDroughtCells } from "./chirps";

export async function getAllHazards(bbox?: number[]): Promise<{ events: HazardEvent[]; statuses: SourceStatus[] }> {
  const [firms, usgs, gdacs] = await Promise.all([
    getFirmsEvents(bbox),
    getUsgsEvents(),
    getGdacsEvents(),
  ]);
  const drought = await getDroughtCells();

  const events: HazardEvent[] = [
    ...firms.events,
    ...usgs.events.filter((e) => !bbox || inBbox(e.geometry, bbox)),
    ...gdacs.events.filter((e) => !bbox || inBbox(e.geometry, bbox)),
  ];
  const statuses: SourceStatus[] = [firms.status, usgs.status, gdacs.status, drought.status];
  return { events, statuses };
}

function inBbox(g: GeoJSON.Geometry, bbox: number[]): boolean {
  if (g.type !== "Point") return false;
  const [lng, lat] = g.coordinates as [number, number];
  return lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3];
}

export async function getSourcesStatus(): Promise<SourceStatus[]> {
  const { statuses } = await getAllHazards();
  const openmeteo: SourceStatus = { id: "openmeteo", name: "Open-Meteo", state: "connected", lastUpdated: new Date().toISOString() };
  const osm: SourceStatus = { id: "osm", name: "OSM via ohsome", state: "cached_fallback", lastUpdated: new Date().toISOString() };
  const llm: SourceStatus = {
    id: "llm",
    name: "LLM Provider",
    state: llmKey() ? "connected" : "needs_api_key",
    lastUpdated: new Date().toISOString(),
    detail: llmProvider(),
  };
  return [...statuses, openmeteo, osm, llm];
}

export function llmKey(): string | undefined {
  return process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
}

export function llmProvider(): "openai" | "openrouter" | "none" {
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.OPENROUTER_API_KEY) return "openrouter";
  return "none";
}

export { getFirmsEvents } from "./firms";
export { getUsgsEvents } from "./usgs";
export { getGdacsEvents } from "./gdacs";
export { getDroughtCells } from "./chirps";
export { getWeather } from "./openmeteo";
export { getOsm, facilityFromFeature } from "./osm";
export type { OsmData } from "./osm";
