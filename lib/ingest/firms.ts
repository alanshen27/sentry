import type { HazardEvent } from "@/lib/types";
import { getFirmsEvents } from "@/lib/sources/firms";
import { DEMO_REGIONS } from "@/lib/demo-regions";
import { bboxOf } from "@/lib/geo";

/**
 * Ingest NASA FIRMS detections across the demo regions' bounding boxes.
 * Requires FIRMS_MAP_KEY. Returns normalized events ready to upsert.
 */
export async function ingestFirmsRegions(): Promise<HazardEvent[]> {
  const all: HazardEvent[] = [];
  for (const r of DEMO_REGIONS) {
    const bbox = bboxOf(r.polygon);
    const { events } = await getFirmsEvents(bbox);
    all.push(...events);
  }
  // dedupe by id
  const seen = new Set<string>();
  return all.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));
}
