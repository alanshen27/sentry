import type { Sector, HazardType, HazardEvent, RiskScore } from "@/lib/types";
import { squareGridInPolygon, pointInPolygon, lengthKm } from "@/lib/geo";
import { polygonIntersects } from "./engine";
import { riskLevelFromScore } from "@/lib/types";

export function segmentRegion(
  polygon: GeoJSON.Polygon,
  cellSizeKm: number,
  opts: {
    events: HazardEvent[];
    hazards: HazardType[];
    riskScores: RiskScore[];
    buildings: GeoJSON.FeatureCollection;
    roads: GeoJSON.FeatureCollection;
    facilities: GeoJSON.FeatureCollection;
  }
): Sector[] {
  const cells = squareGridInPolygon(polygon, cellSizeKm);
  const hazardScoreMap = new Map<HazardType, number>(opts.riskScores.map((r) => [r.hazard, r.score]));

  return cells.map((cell) => {
    const eventsIn = opts.events.filter((e) => e.geometry.type === "Point" && pointInPolygon((e.geometry as GeoJSON.Point).coordinates as [number, number], cell.geometry));
    const riskByHazard: Partial<Record<HazardType, number>> = {};
    let weightedSum = 0, weightTotal = 0;
    for (const h of opts.hazards) {
      const base = hazardScoreMap.get(h) ?? 0;
      const localBoost = eventsIn.filter((e) => e.type === h).reduce((s, e) => s + e.severity * 0.1, 0);
      const v = Math.max(0, Math.min(100, base + localBoost));
      riskByHazard[h] = Math.round(v);
      weightedSum += v;
      weightTotal++;
    }
    const overallRisk = weightTotal ? Math.round(weightedSum / weightTotal) : 0;

    const exposedBuildings = opts.buildings.features.filter((b) => b.geometry.type === "Polygon" && polygonIntersects(b.geometry as GeoJSON.Polygon, cell.geometry)).length;
    const roadLen = opts.roads.features
      .filter((r) => r.geometry.type === "LineString")
      .reduce((s, r) => {
        const coords = (r.geometry as GeoJSON.LineString).coordinates as number[][];
        const inside = coords.some((c) => pointInPoly(c as [number, number], cell.geometry));
        return s + (inside ? lengthKm(r.geometry as GeoJSON.LineString) : 0);
      }, 0);
    const criticalAssets = opts.facilities.features.filter((f) => f.geometry.type === "Point" && pointInPolygon(f.geometry.coordinates as [number, number], cell.geometry)).length;

    return {
      id: cell.id,
      geometry: cell.geometry,
      riskByHazard,
      overallRisk,
      exposedBuildings,
      roadLengthKm: Number(roadLen.toFixed(2)),
      criticalAssets,
      populationEstimate: Math.round(exposedBuildings * 5.2),
      confidence: 0.6,
      center: cell.center,
    };
  });
}

function pointInPoly(pt: [number, number], poly: GeoJSON.Polygon): boolean {
  const ring = poly.coordinates[0];
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    const intersect = yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
