// Core domain types for Sentry

export type HazardType =
  | "wildfire"
  | "earthquake"
  | "flood"
  | "drought"
  | "cyclone"
  | "landslide"
  | "heat"
  | "air_quality"
  | "volcano"
  | "tsunami"
  | "severe_weather";

export type RiskLevel = "Low" | "Moderate" | "High" | "Severe";
export type ConfidenceLabel = "High" | "Medium" | "Low";

export interface HazardEvent {
  id: string;
  type: HazardType;
  source: string;
  geometry: GeoJSON.Geometry;
  severity: number; // 0-100
  confidence: number; // 0-1
  observedAt: string;
  properties?: Record<string, any>;
}

export interface WeatherSignal {
  lat: number;
  lng: number;
  temperatureC: number;
  humidity: number;
  windSpeedKmh: number;
  windDirection: number;
  precipitationMm: number;
  forecastHours: { time: string; tempC: number; precipMm: number; windKmh: number }[];
  updatedAt: string;
}

export interface TriggerAction {
  type:
    | "dashboard_alert"
    | "email"
    | "sms"
    | "webhook"
    | "llm_brief"
    | "incident_task";
  target?: string;
}

export interface TriggerRule {
  id: string;
  zoneId?: string;
  name: string;
  hazard: HazardType;
  metric: string;
  operator: ">" | ">=" | "<" | "<=" | "==" | "change_gt";
  threshold: number;
  durationMinutes: number;
  cooldownMinutes: number;
  actions: TriggerAction[];
  enabled: boolean;
  createdAt: string;
  lastFired?: string;
  naturalLanguage: string;
}

export interface RiskScore {
  hazard: HazardType;
  score: number; // 0-100
  confidence: number; // 0-1
  level: RiskLevel;
  drivers: string[];
  evidence: any[];
}

export interface Sector {
  id: string;
  geometry: GeoJSON.Polygon;
  riskByHazard: Partial<Record<HazardType, number>>;
  overallRisk: number;
  exposedBuildings: number;
  roadLengthKm: number;
  criticalAssets: number;
  populationEstimate: number;
  confidence: number;
  center: [number, number];
}

export interface ExposedAssets {
  buildings: number;
  roadLengthKm: number;
  schools: number;
  hospitals: number;
  clinics: number;
  shelters: number;
  waterPoints: number;
  policeStations: number;
  fireStations: number;
  populationEstimate: number;
  criticalFacilities: CriticalFacility[];
  roads: { id: string; name: string; lengthKm: number }[];
}

export interface CriticalFacility {
  id: string;
  type:
    | "school"
    | "hospital"
    | "clinic"
    | "shelter"
    | "water_point"
    | "police"
    | "fire_station";
  name: string;
  geometry: GeoJSON.Point;
  tags?: Record<string, any>;
}

export interface WatchZone {
  id: string;
  name: string;
  geometry: GeoJSON.Polygon;
  createdAt: string;
  hazards: HazardType[];
  triggers: TriggerRule[];
  notes?: string;
  layerId?: string | null;
  projectId?: string | null;
}

export interface VisionResult {
  smokeProbability: number;
  burnScarProbability: number;
  floodWaterProbability: number;
  vegetationDensity: number;
  cloudObstruction: number;
  confidence: number;
  evidence: string[];
}

export interface AnalysisResult {
  zone: WatchZone;
  sectors: Sector[];
  riskScores: RiskScore[];
  overallRisk: number;
  overallConfidence: number;
  exposedAssets: ExposedAssets;
  brief: BriefResult;
  sources: SourceStatus[];
  updatedAt: string;
}

export interface BriefResult {
  text: string;
  sections: { heading: string; body: string }[];
  generatedAt: string;
  model: string;
  provider: "openai" | "openrouter" | "mock" | "computed";
  suggestedAlerts: string[];
}

export interface SourceStatus {
  id: string;
  name: string;
  state: "connected" | "cached_fallback" | "failed" | "needs_api_key";
  lastUpdated: string;
  detail?: string;
}

export interface DroughtCell {
  cellId: string;
  hazard: "drought";
  riskScore: number;
  anomalyPercent: number;
  confidence: number;
  updatedAt: string;
  geometry: GeoJSON.Polygon;
}

export interface FeedEvent {
  id: string;
  type:
    | "firms_detection"
    | "earthquake"
    | "rainfall_anomaly"
    | "wind_spike"
    | "trigger_fired"
    | "llm_brief"
    | "deep_analysis"
    | "system";
  message: string;
  severity: "info" | "warning" | "critical";
  timestamp: string;
  meta?: Record<string, any>;
}

export interface AlertRecord {
  id: string;
  triggerId: string;
  triggerName: string;
  zoneId?: string;
  zoneName?: string;
  hazard: HazardType;
  message: string;
  severity: RiskLevel;
  brief?: BriefResult;
  timestamp: string;
  acknowledged: boolean;
  actions: TriggerAction[];
}

export const HAZARD_LABELS: Record<HazardType, string> = {
  wildfire: "Wildfire",
  earthquake: "Earthquake",
  flood: "Flood",
  drought: "Drought",
  cyclone: "Cyclone / Storm",
  landslide: "Landslide",
  heat: "Heat",
  air_quality: "Air Quality / Smoke",
  volcano: "Volcano",
  tsunami: "Tsunami",
  severe_weather: "Severe Weather",
};

export const HAZARD_COLORS: Record<HazardType, string> = {
  wildfire: "#ef4444",
  earthquake: "#a78bfa",
  flood: "#38bdf8",
  drought: "#d97706",
  cyclone: "#06b6d4",
  landslide: "#f59e0b",
  heat: "#fb7185",
  air_quality: "#94a3b8",
  volcano: "#dc2626",
  tsunami: "#0ea5e9",
  severe_weather: "#818cf8",
};

export const RISK_LEVEL_COLORS: Record<RiskLevel, string> = {
  Low: "#22c55e",
  Moderate: "#eab308",
  High: "#f97316",
  Severe: "#ef4444",
};

export function riskLevelFromScore(score: number): RiskLevel {
  if (score <= 25) return "Low";
  if (score <= 50) return "Moderate";
  if (score <= 75) return "High";
  return "Severe";
}

export function confidenceLabel(c: number): ConfidenceLabel {
  if (c >= 0.7) return "High";
  if (c >= 0.4) return "Medium";
  return "Low";
}
