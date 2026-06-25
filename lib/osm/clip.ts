import type { OsmData } from "@/lib/sources/osm";
import { polygonIntersects } from "@/lib/risk/engine";
import { pointsInPolygon } from "@/lib/geo";

const DEMO_BBOX: [number, number, number, number] = [39, -1.5, 42.5, 2.5];

function bboxIntersects(a: [number, number, number, number], b: [number, number, number, number]): boolean {
  return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
}

export function demoDataAppliesToBbox(bbox: number[]): boolean {
  const bb = bbox as [number, number, number, number];
  return bboxIntersects(bb, DEMO_BBOX);
}

export function clipOsmToPolygon(polygon: GeoJSON.Polygon, osm: OsmData): OsmData {
  const buildings = osm.buildings.features.filter(
    (b) => b.geometry.type === "Polygon" && polygonIntersects(b.geometry as GeoJSON.Polygon, polygon),
  );
  const roads = osm.roads.features.filter((r) => {
    if (r.geometry.type !== "LineString") return false;
    return (r.geometry.coordinates as number[][]).some((c) => pointInPoly(c as [number, number], polygon));
  });
  const facPts = osm.facilities.features
    .filter((f) => f.geometry.type === "Point")
    .map((f) => ({ geometry: f.geometry as GeoJSON.Point, properties: f }));
  const facIn = pointsInPolygon(facPts, polygon).map((p) => p.properties);

  return {
    buildings: { type: "FeatureCollection", features: buildings },
    roads: { type: "FeatureCollection", features: roads },
    facilities: { type: "FeatureCollection", features: facIn },
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

export function emptyOsm(): OsmData {
  return {
    buildings: { type: "FeatureCollection", features: [] },
    roads: { type: "FeatureCollection", features: [] },
    facilities: { type: "FeatureCollection", features: [] },
  };
}
