import type { HazardType } from "@/lib/types";
import type { LayerToggleState } from "@/lib/store/useAppStore";

/** Sidebar hazard toggles → hazard event types shown on the map. */
export const HAZARD_LAYER_MAP: Partial<Record<keyof LayerToggleState, HazardType>> = {
  wildfire: "wildfire",
  earthquake: "earthquake",
  flood: "flood",
  drought: "drought",
  cyclone: "cyclone",
  landslide: "landslide",
  heat: "heat",
  air_quality: "air_quality",
};

export function activeHazardTypes(layers: LayerToggleState): HazardType[] {
  return (Object.entries(HAZARD_LAYER_MAP) as [keyof LayerToggleState, HazardType][])
    .filter(([key]) => layers[key])
    .map(([, hazard]) => hazard);
}

export function filterEventsByLayers<T extends { type: HazardType }>(events: T[], layers: LayerToggleState): T[] {
  const active = new Set(activeHazardTypes(layers));
  return events.filter((e) => active.has(e.type));
}
