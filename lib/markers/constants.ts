/** Condition / assessment state for a marker (color-coded on map). */
export const MARKER_STATES = [
  "safe",
  "pending",
  "verified",
  "unknown",
  "damaged",
  "destroyed",
] as const;

export type MarkerState = (typeof MARKER_STATES)[number];

export const MARKER_STATE_LABELS: Record<MarkerState, string> = {
  safe: "Safe",
  pending: "Pending review",
  verified: "Field verified",
  unknown: "Unknown",
  damaged: "Damaged",
  destroyed: "Destroyed",
};

export const MARKER_STATE_COLORS: Record<string, string> = {
  safe: "#22c55e",
  pending: "#eab308",
  verified: "#38bdf8",
  unknown: "#94a3b8",
  damaged: "#f97316",
  destroyed: "#ef4444",
};

/** Building / POI type (from OSM tags or manual entry). */
export const MARKER_CATEGORIES = [
  "house",
  "residential",
  "apartments",
  "school",
  "hospital",
  "clinic",
  "shelter",
  "commercial",
  "industrial",
  "retail",
  "church",
  "mosque",
  "observation",
  "fire",
  "flood",
  "custom",
] as const;

export type MarkerCategory = (typeof MARKER_CATEGORIES)[number];

export const MARKER_CATEGORY_LABELS: Record<string, string> = {
  house: "House",
  residential: "Residential",
  apartments: "Apartments",
  school: "School",
  hospital: "Hospital",
  clinic: "Clinic",
  shelter: "Shelter",
  commercial: "Commercial",
  industrial: "Industrial",
  retail: "Retail",
  church: "Church",
  mosque: "Mosque",
  observation: "Observation",
  fire: "Fire",
  flood: "Flood",
  custom: "Custom",
};

export function markerCategoryLabel(category: string): string {
  return MARKER_CATEGORY_LABELS[category] ?? category.charAt(0).toUpperCase() + category.slice(1);
}
