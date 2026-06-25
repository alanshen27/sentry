import type { OsmData } from "./osm";
import { emptyOsm } from "@/lib/osm/clip";

const OHSOME_BASE = "https://api.ohsome.org/v1";
const DEFAULT_TIMEOUT_S = 120;

function flatTags(props: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const tags = (props?.tags as Record<string, string> | undefined) ?? {};
  const id = props?.["@osmId"] ?? props?.["@osmVersion"];
  return { ...tags, id: id != null ? String(id) : undefined };
}

function featureId(props: Record<string, unknown>, fallback: string): string {
  const id = props.id;
  return typeof id === "string" || typeof id === "number" ? String(id) : fallback;
}

function flatTagsFromFeature(f: GeoJSON.Feature): Record<string, unknown> {
  return flatTags(f.properties as Record<string, unknown> | null | undefined);
}

function snapBbox(bbox: number[]): number[] {
  const snap = (n: number) => Math.round(n * 1000) / 1000;
  return [snap(bbox[0]), snap(bbox[1]), snap(bbox[2]), snap(bbox[3])];
}

function bboxString(bbox: number[]): string {
  const [minLng, minLat, maxLng, maxLat] = snapBbox(bbox);
  return `${minLng},${minLat},${maxLng},${maxLat}`;
}

function polygonToBpolys(polygon: GeoJSON.Polygon): string {
  return JSON.stringify({
    type: "FeatureCollection",
    features: [{ type: "Feature", properties: {}, geometry: polygon }],
  });
}

async function fetchLayer(
  boundary: { bbox: number[]; polygon?: GeoJSON.Polygon },
  filter: string,
  timeout = DEFAULT_TIMEOUT_S,
): Promise<GeoJSON.FeatureCollection> {
  // No `time` param: ohsome defaults to the latest available snapshot. Passing
  // today's date 404s because the osh-data timeframe lags real time by days.
  const payload: Record<string, string | number> = {
    filter,
    properties: "tags",
    timeout,
  };

  if (boundary.polygon) {
    payload.bpolys = polygonToBpolys(boundary.polygon);
  } else {
    payload.bboxes = bboxString(boundary.bbox);
  }

  const res = await fetch(`${OHSOME_BASE}/elements/geometry`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/geo+json, application/json" },
    body: new URLSearchParams(Object.entries(payload).map(([k, v]) => [k, String(v)])).toString(),
  });

  if (res.status === 429 || res.status === 503) {
    throw new Error(`ohsome ${res.status} — service busy, try a smaller region`);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ohsome ${res.status}${text ? `: ${text.slice(0, 120)}` : ""}`);
  }

  const data = await res.json();
  if (data?.type === "FeatureCollection") return data as GeoJSON.FeatureCollection;
  if (data?.features) return { type: "FeatureCollection", features: data.features };
  return { type: "FeatureCollection", features: [] };
}

function normalizeBuildings(fc: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection {
  const features = fc.features
    .filter((f) => f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon")
    .map((f, i) => {
      const props = flatTagsFromFeature(f);
      const fid = featureId(props, `b_${i}`);
      const geom = f.geometry.type === "MultiPolygon"
        ? { type: "Polygon" as const, coordinates: (f.geometry as GeoJSON.MultiPolygon).coordinates[0] }
        : f.geometry as GeoJSON.Polygon;
      return {
        type: "Feature" as const,
        id: fid,
        geometry: geom,
        properties: {
          ...props,
          id: fid,
          source: "ohsome",
          building: String(props.building ?? "yes"),
          areaM2: 0,
          confidence: 0.75,
        },
      };
    });
  return { type: "FeatureCollection", features };
}

function normalizeRoads(fc: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection {
  const features = fc.features
    .filter((f) => f.geometry.type === "LineString" || f.geometry.type === "MultiLineString")
    .map((f, i) => {
      const props = flatTagsFromFeature(f);
      const fid = featureId(props, `r_${i}`);
      const geom = f.geometry.type === "MultiLineString"
        ? { type: "LineString" as const, coordinates: (f.geometry as GeoJSON.MultiLineString).coordinates[0] }
        : f.geometry as GeoJSON.LineString;
      return {
        type: "Feature" as const,
        id: fid,
        geometry: geom,
        properties: {
          id: fid,
          highway: String(props.highway ?? "road"),
          name: String(props.name ?? ""),
        },
      };
    });
  return { type: "FeatureCollection", features };
}

function normalizeFacilities(fc: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection {
  const features = fc.features
    .filter((f) => f.geometry.type === "Point")
    .map((f, i) => {
      const props = flatTagsFromFeature(f);
      const fid = featureId(props, `f_${i}`);
      const amenity = String(props.amenity ?? props.type ?? "facility");
      return {
        type: "Feature" as const,
        id: fid,
        geometry: f.geometry as GeoJSON.Point,
        properties: {
          id: fid,
          type: amenity,
          amenity,
          name: String(props.name ?? amenity),
          emergency: props.emergency,
        },
      };
    });
  return { type: "FeatureCollection", features };
}

export async function fetchOhsomeExposure(
  bbox: number[],
  polygon?: GeoJSON.Polygon,
): Promise<OsmData> {
  const boundary = { bbox, polygon };
  const [buildingsRes, roadsRes, facilitiesRes] = await Promise.all([
    fetchLayer(boundary, "building=* and building!=no and geometry:polygon"),
    fetchLayer(boundary, "highway=* and geometry:line"),
    fetchLayer(boundary, "amenity in (hospital, clinic, school, shelter) and geometry:point"),
  ]);

  return {
    buildings: normalizeBuildings(buildingsRes),
    roads: normalizeRoads(roadsRes),
    facilities: normalizeFacilities(facilitiesRes),
  };
}

export function emptyOsmData(): OsmData {
  return emptyOsm();
}
