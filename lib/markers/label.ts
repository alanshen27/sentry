import { pointInPolygon } from "@/lib/geo";
import type { Sector } from "@/lib/types";
import { markerCategoryLabel } from "@/lib/markers/constants";

export function categoryFromOsmTags(props: Record<string, unknown>): string {
  const amenity = String(props.amenity ?? "").toLowerCase();
  if (["school", "hospital", "clinic", "shelter"].includes(amenity)) return amenity;
  const building = String(props.building ?? "house").toLowerCase();
  if (building === "yes") return "house";
  if (["school", "hospital", "clinic", "shelter"].includes(building)) return building;
  return building;
}

export function typeLabel(category: string): string {
  return markerCategoryLabel(category);
}

export function placeFromProps(props: Record<string, unknown>): string | null {
  const name = props.name ?? props["addr:place"];
  if (name && String(name).trim()) return String(name).trim();

  const street = props["addr:street"];
  const num = props["addr:housenumber"];
  const locality = props["addr:city"] ?? props["addr:suburb"] ?? props["addr:town"] ?? props["addr:village"];

  if (street && num) {
    const line = `${num} ${street}`;
    return locality ? `${line}, ${locality}` : line;
  }
  if (street) return locality ? `${street}, ${locality}` : String(street);
  if (locality) return String(locality);
  return null;
}

export function formatCoord(lat: number, lng: number): string {
  const latH = lat >= 0 ? "N" : "S";
  const lngH = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(3)}°${latH}, ${Math.abs(lng).toFixed(3)}°${lngH}`;
}

export function sectorAtPoint(lng: number, lat: number, sectors: Sector[]): string | null {
  for (const s of sectors) {
    if (pointInPolygon([lng, lat], s.geometry)) return s.id;
  }
  return null;
}

/** Human-readable marker name: type · place/coords · sector */
export function buildMarkerLabel(
  category: string,
  props: Record<string, unknown>,
  lng: number,
  lat: number,
  sectorId?: string | null,
): string {
  const kind = typeLabel(category);
  const place = placeFromProps(props);
  const where = place ?? formatCoord(lat, lng);
  const parts = [kind, where];
  if (sectorId) parts.push(`Sector ${sectorId}`);
  return parts.join(" · ");
}
