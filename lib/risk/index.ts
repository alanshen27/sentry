import type { HazardType, HazardEvent, RiskScore, Sector, ExposedAssets, WeatherSignal, DroughtCell, SourceStatus } from "@/lib/types";
import { getAllHazards } from "@/lib/sources";
import { getWeather } from "@/lib/sources";
import { getOsm, type OsmData } from "@/lib/sources";
import { getDroughtCells } from "@/lib/sources/chirps";
import { bboxOf, areaKm2 } from "@/lib/geo";
import { computeRiskScores, overallRisk, overallConfidence, type RiskInput } from "./engine";
import { segmentRegion } from "./segment";
import { computeExposedAssets } from "./exposure";
import { clipOsmToPolygon } from "@/lib/osm/clip";

export interface AnalyzeRegionInput {
  geometry: GeoJSON.Polygon;
  hazards: HazardType[];
  deepAnalysis?: boolean;
  cellSizeKm?: number;
}

export interface AnalyzeRegionResult {
  riskScores: RiskScore[];
  overallRisk: number;
  overallConfidence: number;
  sectors: Sector[];
  exposedAssets: ExposedAssets;
  events: HazardEvent[];
  weather: WeatherSignal | null;
  osm: OsmData;
  sources: SourceStatus[];
  areaKm2: number;
  updatedAt: string;
}

export async function analyzeRegion(input: AnalyzeRegionInput): Promise<AnalyzeRegionResult> {
  const { geometry, hazards, deepAnalysis, cellSizeKm } = input;
  const bbox = bboxOf(geometry);
  const [hazRes, weatherRes, osmRes, droughtRes] = await Promise.all([
    getAllHazards(bbox),
    getWeather(centerLat(geometry), centerLng(geometry)),
    getOsm(bbox, geometry),
    getDroughtCells(),
  ]);

  const riskInput: RiskInput = {
    polygon: geometry,
    hazards,
    events: hazRes.events,
    weather: weatherRes.signal,
    buildings: osmRes.data.buildings,
    roads: osmRes.data.roads,
    facilities: osmRes.data.facilities,
    droughtCells: droughtRes.cells,
    osmState: osmRes.status.state,
  };

  const riskScores = computeRiskScores(riskInput);
  const sectors = segmentRegion(geometry, cellSizeKm ?? 8, {
    events: hazRes.events,
    hazards,
    riskScores,
    buildings: osmRes.data.buildings,
    roads: osmRes.data.roads,
    facilities: osmRes.data.facilities,
  });
  const osmClipped = clipOsmToPolygon(geometry, osmRes.data);
  const exposedAssets = computeExposedAssets(geometry, osmClipped.buildings, osmClipped.roads, osmClipped.facilities);

  return {
    riskScores,
    overallRisk: overallRisk(riskScores),
    overallConfidence: overallConfidence(riskScores),
    sectors,
    exposedAssets,
    events: hazRes.events,
    weather: weatherRes.signal,
    osm: osmClipped,
    sources: [...hazRes.statuses, weatherRes.status, osmRes.status],
    areaKm2: Number(areaKm2(geometry).toFixed(1)),
    updatedAt: new Date().toISOString(),
  };
}

export function centerLat(poly: GeoJSON.Polygon): number {
  const ring = poly.coordinates[0];
  return ring.reduce((s, p) => s + p[1], 0) / ring.length;
}
export function centerLng(poly: GeoJSON.Polygon): number {
  const ring = poly.coordinates[0];
  return ring.reduce((s, p) => s + p[0], 0) / ring.length;
}

export { computeRiskScores } from "./engine";
export { segmentRegion } from "./segment";
export { computeExposedAssets } from "./exposure";
