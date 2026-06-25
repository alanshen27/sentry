import type { RiskScore, Sector } from "@/lib/types";
import { buildMarkerLabel, categoryFromOsmTags, sectorAtPoint } from "@/lib/markers/label";
import { MARKER_STATE_COLORS } from "@/lib/markers/constants";

export interface HouseEvalMarker {
  geometry: GeoJSON.Point;
  label: string;
  color: string;
  state: string;
  category: string;
  sizeM2: number | null;
  confidence: number | null;
  source: string;
  notes: string | null;
}

function centroid(poly: GeoJSON.Polygon): [number, number] {
  const ring = poly.coordinates[0];
  const lng = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const lat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  return [lng, lat];
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const STATE_COLORS = MARKER_STATE_COLORS;

/**
 * Evaluate building footprints and emit a marker for EVERY footprint.
 * Deterministic (seeded by footprint id). State is inferred from overall hazard
 * severity + footprint size. This is decision support, not a damage claim.
 */
export function evaluateBuildings(
  buildings: GeoJSON.FeatureCollection,
  riskScores: RiskScore[],
  primaryHazard: string,
  sectors: Sector[] = [],
): HouseEvalMarker[] {
  const topRisk = Math.max(0, ...riskScores.map((r) => r.score));
  const markers: HouseEvalMarker[] = [];

  for (const f of buildings.features) {
    if (f.geometry.type !== "Polygon") continue;
    const props = (f.properties ?? {}) as Record<string, unknown>;
    const id = String(props.id ?? f.id ?? Math.random().toString());
    const area = Number(props.areaM2 ?? estimateArea(f.geometry)) || 60;
    const [lng, lat] = centroid(f.geometry);
    const h = hash(id);

    const r = (h % 1000) / 1000;
    const damageThreshold = 0.5 - (topRisk / 100) * 0.4;
    let state: string;
    if (topRisk < 30) state = "safe";
    else if (r > damageThreshold + 0.3) state = "safe";
    else if (r > damageThreshold + 0.15) state = "pending";
    else if (r > damageThreshold + 0.05) state = "damaged";
    else if (r > damageThreshold - 0.05) state = "destroyed";
    else state = "unknown";

    const category = categoryFromOsmTags(props);
    const sectorId = sectorAtPoint(lng, lat, sectors);
    const confidence = Number((0.5 + (topRisk / 100) * 0.2).toFixed(2));

    markers.push({
      geometry: { type: "Point", coordinates: [lng, lat] },
      label: buildMarkerLabel(category, props, lng, lat, sectorId),
      color: STATE_COLORS[state],
      state,
      category,
      sizeM2: Math.round(area),
      confidence,
      source: "analysis",
      notes: `Estimated via ${primaryHazard} exposure (top risk ${topRisk}/100). NOT field-verified.`,
    });
  }
  return markers;
}

function estimateArea(poly: GeoJSON.Polygon): number {
  const ring = poly.coordinates[0];
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  }
  const deg2 = Math.abs(a / 2);
  return Math.round(deg2 * 111 * 111 * 1000 * Math.cos((ring[0][1] * Math.PI) / 180));
}
