/** Strip closing duplicate from GeoJSON polygon outer ring. */
export function openRing(poly: GeoJSON.Polygon): number[][] {
  const ring = poly.coordinates[0] ?? [];
  if (ring.length < 2) return ring.map((c) => [...c]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  const closed = first[0] === last[0] && first[1] === last[1];
  return (closed ? ring.slice(0, -1) : ring).map((c) => [c[0], c[1]]);
}

export function closedPolygon(ring: number[][]): GeoJSON.Polygon {
  if (ring.length < 3) throw new Error("need at least 3 vertices");
  const first = ring[0];
  const last = ring[ring.length - 1];
  const closed = first[0] === last[0] && first[1] === last[1];
  const coords = closed ? ring : [...ring, first];
  return { type: "Polygon", coordinates: [coords] };
}

export type LngLat = [number, number];

/** Screen-space snap — returns index of snapped vertex or -1. */
export function snapVertexIndex(
  project: (lngLat: LngLat) => { x: number; y: number },
  point: LngLat,
  vertices: LngLat[],
  pxThreshold = 14,
  excludeIndex = -1,
): number {
  const p = project(point);
  let best = -1;
  let bestDist = pxThreshold;
  vertices.forEach((v, i) => {
    if (i === excludeIndex) return;
    const vp = project(v);
    const d = Math.hypot(vp.x - p.x, vp.y - p.y);
    if (d <= bestDist) {
      bestDist = d;
      best = i;
    }
  });
  return best;
}

export function snapCoord(
  project: (lngLat: LngLat) => { x: number; y: number },
  point: LngLat,
  vertices: LngLat[],
  pxThreshold = 14,
  excludeIndex = -1,
): LngLat | null {
  const idx = snapVertexIndex(project, point, vertices, pxThreshold, excludeIndex);
  return idx >= 0 ? [...vertices[idx]] as LngLat : null;
}
