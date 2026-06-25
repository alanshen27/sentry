import type { HazardType } from "@/lib/types";

export interface DemoRegion {
  id: string;
  name: string;
  description: string;
  center: [number, number];
  zoom: number;
  polygon: GeoJSON.Polygon;
  hazards: HazardType[];
  accent: string;
}

// Rough hand-drawn polygons around each demo area
export const DEMO_REGIONS: DemoRegion[] = [
  {
    id: "somalia_south",
    name: "Southern Somalia",
    description: "Drought + flood-risk corridor around Shabelle / Juba",
    center: [43.5, 2.5],
    zoom: 7,
    hazards: ["drought", "flood", "wildfire"],
    accent: "#d97706",
    polygon: {
      type: "Polygon",
      coordinates: [
        [
          [41.8, 4.2], [44.8, 4.4], [45.2, 1.2], [44.0, -0.6],
          [41.6, 0.2], [41.2, 2.6], [41.8, 4.2],
        ],
      ],
    },
  },
  {
    id: "kenya_somalia_border",
    name: "Kenya / Somalia Border",
    description: "Wildfire detections + cross-border coordination zone",
    center: [40.8, 0.4],
    zoom: 7,
    hazards: ["wildfire", "drought", "severe_weather"],
    accent: "#ef4444",
    polygon: {
      type: "Polygon",
      coordinates: [
        [
          [39.4, 1.8], [42.2, 1.9], [42.4, -1.2], [41.0, -1.6],
          [39.2, -0.4], [39.4, 1.8],
        ],
      ],
    },
  },
  {
    id: "california_wildfire",
    name: "California Wildfire",
    description: "FIRMS-active wildfire zone, Los Padres / Sierra Nevada",
    center: [-119.5, 36.2],
    zoom: 7,
    hazards: ["wildfire", "heat", "air_quality"],
    accent: "#ef4444",
    polygon: {
      type: "Polygon",
      coordinates: [
        [
          [-121.6, 37.4], [-117.4, 37.5], [-117.2, 34.9], [-119.8, 34.6],
          [-121.8, 35.6], [-121.6, 37.4],
        ],
      ],
    },
  },
  {
    id: "philippines_cyclone",
    name: "Philippines Cyclone",
    description: "Cyclone track + storm-surge exposure, Visayas / Bicol",
    center: [124.0, 12.0],
    zoom: 6,
    hazards: ["cyclone", "flood", "landslide"],
    accent: "#06b6d4",
    polygon: {
      type: "Polygon",
      coordinates: [
        [
          [120.0, 14.5], [127.0, 14.6], [127.4, 9.4], [123.8, 9.0],
          [120.2, 11.0], [120.0, 14.5],
        ],
      ],
    },
  },
  {
    id: "nepal_landslide",
    name: "Nepal Landslide",
    description: "Monsoon rainfall + steep-slope landslide exposure",
    center: [84.0, 28.2],
    zoom: 8,
    hazards: ["landslide", "flood", "earthquake"],
    accent: "#f59e0b",
    polygon: {
      type: "Polygon",
      coordinates: [
        [
          [82.4, 29.2], [85.8, 29.3], [86.2, 27.4], [84.6, 26.7],
          [82.2, 27.6], [82.4, 29.2],
        ],
      ],
    },
  },
];

export function getDemoRegion(id: string): DemoRegion | undefined {
  return DEMO_REGIONS.find((r) => r.id === id);
}
