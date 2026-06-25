import type { ExposedAssets, CriticalFacility } from "@/lib/types";
import { facilityFromFeature } from "@/lib/sources/osm";
import { pointsInPolygon, lengthKm } from "@/lib/geo";
import { polygonIntersects } from "./engine";

export function computeExposedAssets(
  polygon: GeoJSON.Polygon,
  buildings: GeoJSON.FeatureCollection,
  roads: GeoJSON.FeatureCollection,
  facilities: GeoJSON.FeatureCollection
): ExposedAssets {
  const exposedBuildings = buildings.features.filter(
    (b) => b.geometry.type === "Polygon" && polygonIntersects(b.geometry as GeoJSON.Polygon, polygon)
  );

  const facPts = facilities.features
    .filter((f) => f.geometry.type === "Point")
    .map((f) => ({ geometry: f.geometry as GeoJSON.Point, properties: f }));
  const facIn = pointsInPolygon(facPts, polygon).map((p) => p.properties);

  const critical: CriticalFacility[] = [];
  let schools = 0, hospitals = 0, clinics = 0, shelters = 0, waterPoints = 0, police = 0, fire = 0;
  for (const f of facIn) {
    const cf = facilityFromFeature(f);
    if (!cf) continue;
    critical.push(cf);
    switch (cf.type) {
      case "school": schools++; break;
      case "hospital": hospitals++; break;
      case "clinic": clinics++; break;
      case "shelter": shelters++; break;
      case "water_point": waterPoints++; break;
      case "police": police++; break;
      case "fire_station": fire++; break;
    }
  }

  const roadsIn = roads.features.filter((r) => {
    if (r.geometry.type !== "LineString") return false;
    const coords = r.geometry.coordinates as number[][];
    return coords.some((c) => {
      // reuse polygonIntersects by wrapping point cheaply
      try {
        return pointInPoly(c as [number, number], polygon);
      } catch { return false; }
    });
  });
  const roadLengthKm = roadsIn.reduce((s, r) => s + lengthKm(r.geometry as GeoJSON.LineString), 0);

  const populationEstimate = Math.round(exposedBuildings.length * 5.2);

  return {
    buildings: exposedBuildings.length,
    roadLengthKm: Number(roadLengthKm.toFixed(1)),
    schools, hospitals, clinics, shelters, waterPoints, policeStations: police, fireStations: fire,
    populationEstimate,
    criticalFacilities: critical,
    roads: roadsIn.map((r) => ({ id: r.properties?.id ?? "", name: r.properties?.name ?? "unnamed", lengthKm: Number(lengthKm(r.geometry as GeoJSON.LineString).toFixed(2)) })),
  };
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
