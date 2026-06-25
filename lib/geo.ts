import bboxTurf from "@turf/bbox";
import areaTurf from "@turf/area";
import centerTurf from "@turf/center";
import bufferTurf from "@turf/buffer";
import lengthTurf from "@turf/length";
import distanceTurf from "@turf/distance";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import squareGrid from "@turf/square-grid";
import pointsWithinPolygon from "@turf/points-within-polygon";
import { polygon as turfPolygon, point as turfPoint } from "@turf/helpers";

export type BBox = [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]

export function bboxOf(geojson: GeoJSON.Geometry | GeoJSON.Feature): BBox {
  return bboxTurf(geojson as any) as BBox;
}

export function areaKm2(geojson: GeoJSON.Geometry): number {
  return areaTurf(geojson as any) / 1_000_000;
}

export function centerOf(geojson: GeoJSON.Geometry | GeoJSON.Feature): [number, number] {
  const c = centerTurf(geojson as any);
  return c.geometry.coordinates as [number, number];
}

export function bufferKm(geojson: GeoJSON.Geometry, km: number): GeoJSON.Feature {
  return bufferTurf(geojson as any, km, { units: "kilometers" }) as unknown as GeoJSON.Feature;
}

export function lengthKm(geojson: GeoJSON.Geometry | GeoJSON.Feature): number {
  return lengthTurf(geojson as any, { units: "kilometers" });
}

export function distanceKm(a: [number, number], b: [number, number]): number {
  return distanceTurf(turfPoint(a), turfPoint(b), { units: "kilometers" });
}

export function pointInPolygon(pt: [number, number], poly: GeoJSON.Polygon): boolean {
  return booleanPointInPolygon(turfPoint(pt), poly as any);
}

export function makePolygon(rings: number[][][]): GeoJSON.Polygon {
  return turfPolygon(rings).geometry as GeoJSON.Polygon;
}

export interface GridCell {
  id: string;
  geometry: GeoJSON.Polygon;
  center: [number, number];
}

export function squareGridInPolygon(
  poly: GeoJSON.Polygon,
  cellSizeKm: number
): GridCell[] {
  const [minLng, minLat, maxLng, maxLat] = bboxOf(poly);
  const grid = squareGrid([minLng, minLat, maxLng, maxLat], cellSizeKm, {
    units: "kilometers",
    mask: poly as any,
  });
  return grid.features.map((f, i) => {
    const g = f.geometry as GeoJSON.Polygon;
    return { id: `cell_${i}`, geometry: g, center: centerOf(g) };
  });
}

export function pointsInPolygon(
  points: { geometry: GeoJSON.Point; properties?: any }[],
  poly: GeoJSON.Polygon
): { geometry: GeoJSON.Point; properties?: any }[] {
  if (points.length === 0) return [];
  const fc = {
    type: "FeatureCollection" as const,
    features: points.map((p) => ({
      type: "Feature" as const,
      geometry: p.geometry,
      properties: p.properties ?? {},
    })),
  };
  const result = pointsWithinPolygon(fc as any, poly as any) as any;
  return (result.features ?? []).map((f: any) => ({
    geometry: f.geometry,
    properties: f.properties,
  }));
}

/**
 * Build a rough downwind cone from a source point given wind direction (deg, meteorological:
 * direction wind blows FROM). Returns a buffered polygon approximating the downwind plume.
 */
export function downwindBuffer(
  source: [number, number],
  windFromDeg: number,
  lengthKm: number,
  spreadDeg = 35
): GeoJSON.Polygon | null {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const bearingTo = (windFromDeg + 180) % 360; // direction wind blows TO
  const center = turfPoint(source);
  // approximate 1 degree lat ~ 111km; build a triangle of points then buffer
  const len = lengthKm;
  const spread = spreadDeg;
  const leftBearing = (bearingTo - spread / 2 + 360) % 360;
  const rightBearing = (bearingTo + spread / 2) % 360;
  const dest = (brg: number, d: number): [number, number] => {
    const R = 6371;
    const lat1 = toRad(source[1]);
    const lng1 = toRad(source[0]);
    const b = toRad(brg);
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(d / R) + Math.cos(lat1) * Math.sin(d / R) * Math.cos(b)
    );
    const lng2 =
      lng1 +
      Math.atan2(
        Math.sin(b) * Math.sin(d / R) * Math.cos(lat1),
        Math.cos(d / R) - Math.sin(lat1) * Math.sin(lat2)
      );
    return [(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI];
  };
  const p0 = source;
  const p1 = dest(leftBearing, len);
  const p2 = dest(rightBearing, len);
  const tri = turfPolygon([[p0, p1, p2, p0]]);
  const buf = bufferTurf(tri, Math.max(0.5, len * 0.08), { units: "kilometers" });
  return (buf as any)?.geometry ?? null;
}

export { turfPoint, turfPolygon };
