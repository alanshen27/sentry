import type { HazardEvent, HazardType, RiskScore, WeatherSignal, ExposedAssets, DroughtCell } from "@/lib/types";
import { riskLevelFromScore } from "@/lib/types";
import { bboxOf, pointsInPolygon, pointInPolygon, distanceKm, areaKm2, downwindBuffer, bufferKm } from "@/lib/geo";

export interface RiskInput {
  polygon: GeoJSON.Polygon;
  hazards: HazardType[];
  events: HazardEvent[];
  weather: WeatherSignal | null;
  buildings: GeoJSON.FeatureCollection;
  roads: GeoJSON.FeatureCollection;
  facilities: GeoJSON.FeatureCollection;
  droughtCells: DroughtCell[];
  osmState: "connected" | "cached_fallback" | "failed" | "needs_api_key";
}

function eventsIn(events: HazardEvent[], poly: GeoJSON.Polygon, type: HazardType, bufferKmVal = 0): HazardEvent[] {
  const pts = events.filter((e) => e.type === type && e.geometry.type === "Point").map((e) => ({ geometry: e.geometry as GeoJSON.Point, properties: e }));
  if (bufferKmVal <= 0) {
    return pointsInPolygon(pts, poly).map((p) => p.properties);
  }
  const buffered = bufferKm(poly, bufferKmVal).geometry as GeoJSON.Polygon;
  return pointsInPolygon(pts, buffered).map((p) => p.properties);
}

function clamp(n: number, lo = 0, hi = 100) { return Math.max(lo, Math.min(hi, n)); }

export function scoreWildfire(input: RiskInput): RiskScore {
  const { polygon, events, weather, buildings, osmState } = input;
  const fires = eventsIn(events, polygon, "wildfire", 20);
  const activeFireScore = clamp(fires.reduce((s, f) => s + (f.severity * (f.confidence ?? 0.6)), 0) / 5, 0, 100);

  let weatherScore = 50;
  const drivers: string[] = [];
  if (weather) {
    const tempC = weather.temperatureC;
    const hum = weather.humidity;
    const precip = weather.precipitationMm;
    weatherScore = clamp(
      (tempC > 35 ? 90 : tempC > 30 ? 70 : tempC > 25 ? 50 : 30) * 0.4 +
      (hum < 25 ? 90 : hum < 40 ? 70 : hum < 60 ? 50 : 25) * 0.35 +
      (precip < 1 ? 85 : precip < 5 ? 55 : 25) * 0.25
    );
    drivers.push(`Temp ${tempC.toFixed(0)}°C, humidity ${hum}%, precip ${precip}mm`);
  } else {
    drivers.push("No local weather reading (using defaults)");
  }

  const exposure = buildings.features.filter((b) => b.geometry.type === "Polygon" && polygonIntersects(b.geometry as GeoJSON.Polygon, polygon)).length;
  const exposureScore = clamp(exposure / 2, 0, 100);

  let windScore = 40;
  if (weather && fires.length > 0) {
    const fireCenter = fires[0].geometry.type === "Point" ? (fires[0].geometry.coordinates as [number, number]) : [0, 0] as [number, number];
    const dw = downwindBuffer(fireCenter, weather.windDirection, 25);
    const downwindBldg = dw ? buildings.features.filter((b) => b.geometry.type === "Polygon" && polygonIntersects(b.geometry as GeoJSON.Polygon, dw)).length : 0;
    windScore = clamp(30 + downwindBldg * 4 + (weather.windSpeedKmh > 25 ? 20 : 0));
    if (downwindBldg > 0) drivers.push(`~${downwindBldg} buildings in downwind plume (wind ${weather.windSpeedKmh.toFixed(0)} km/h)`);
  }

  const droughtCells = input.droughtCells.filter((c) => pointInPolygon([c.geometry.coordinates[0][0][0], c.geometry.coordinates[0][0][1]], polygon));
  const droughtScore = droughtCells.length ? clamp(droughtCells.reduce((s, c) => s + c.riskScore, 0) / droughtCells.length) : 35;

  const trendScore = clamp(activeFireScore * 0.7 + (fires.length > 3 ? 20 : 0));

  const score = clamp(
    0.35 * activeFireScore +
    0.20 * weatherScore +
    0.15 * windScore +
    0.10 * droughtScore +
    0.10 * exposureScore +
    0.10 * trendScore
  );

  const confidence = clamp01(
    (fires.length > 0 ? 0.35 : 0.2) +
    (weather ? 0.2 : 0.05) +
    (osmState === "connected" ? 0.15 : 0.08) +
    0.1 // satellite baseline
  );

  if (fires.length > 0) drivers.unshift(`${fires.length} active FIRMS detection${fires.length > 1 ? "s" : ""} within 20km buffer`);
  drivers.push(`Exposure: ~${exposure} building footprints in zone`);

  return {
    hazard: "wildfire",
    score: Math.round(score),
    confidence: Number(confidence.toFixed(2)),
    level: riskLevelFromScore(score),
    drivers: drivers.slice(0, 5),
    evidence: [{ fires: fires.length, activeFireScore: Math.round(activeFireScore), weatherScore: Math.round(weatherScore), windScore: Math.round(windScore) }],
  };
}

export function scoreEarthquake(input: RiskInput): RiskEvent {
  const { polygon, events, buildings } = input;
  const quakes = eventsIn(events, polygon, "earthquake", 100);
  const center = polygonCenter(polygon);
  let score = 5;
  const drivers: string[] = [];
  if (quakes.length > 0) {
    const q = quakes.sort((a, b) => (b.properties?.magnitude ?? 0) - (a.properties?.magnitude ?? 0))[0];
    const mag = q.properties?.magnitude ?? 0;
    const dist = distanceKm(center, q.geometry.type === "Point" ? (q.geometry.coordinates as [number, number]) : center);
    const distanceDecay = clamp(100 - dist * 0.5, 0, 100) / 100;
    const depthFactor = clamp(100 - (q.properties?.depthKm ?? 20), 10, 100) / 100;
    const magScore = clamp((mag / 7) * 100);
    const exposure = buildings.features.filter((b) => b.geometry.type === "Polygon" && polygonIntersects(b.geometry as GeoJSON.Polygon, polygon)).length;
    const exposureScore = clamp(exposure / 3, 0, 100);
    score = clamp(magScore * distanceDecay * depthFactor * 0.7 + exposureScore * 0.3);
    drivers.push(`M${mag} at ${dist.toFixed(0)}km, depth ${q.properties?.depthKm ?? "?"}km (${q.properties?.place ?? ""})`);
    drivers.push(`Exposure: ~${exposure} building footprints`);
  } else {
    drivers.push("No recent earthquakes within 100km — monitoring only");
  }
  return {
    hazard: "earthquake",
    score: Math.round(score),
    confidence: 0.5,
    level: riskLevelFromScore(score),
    drivers,
    evidence: [{ quakes: quakes.length }],
  };
}

export function scoreFlood(input: RiskInput): RiskScore {
  const { polygon, events, weather, buildings } = input;
  const floodEvents = eventsIn(events, polygon, "flood", 30);
  const gdacsFlood = events.filter((e) => e.type === "flood" || e.properties?.alertLevel);
  let score = 30;
  const drivers: string[] = [];
  const rainScore = weather ? clamp(weather.precipitationMm * 12 + (weather.forecastHours.slice(0, 6).reduce((s, h) => s + h.precipMm, 0)) * 3) : 35;
  const eventScore = floodEvents.length > 0 ? clamp(floodEvents.reduce((s, e) => s + e.severity, 0) / floodEvents.length) : 25;
  const exposure = buildings.features.filter((b) => b.geometry.type === "Polygon" && polygonIntersects(b.geometry as GeoJSON.Polygon, polygon)).length;
  const exposureScore = clamp(exposure / 2.5, 0, 100);
  score = clamp(0.45 * rainScore + 0.25 * eventScore + 0.30 * exposureScore);
  if (weather) drivers.push(`Recent + forecast precip: ${weather.precipitationMm}mm`);
  if (floodEvents.length) drivers.push(`${floodEvents.length} flood alert(s) nearby`);
  drivers.push("No river gauges available — confidence reduced");
  return {
    hazard: "flood",
    score: Math.round(score),
    confidence: 0.55,
    level: riskLevelFromScore(score),
    drivers: drivers.slice(0, 5),
    evidence: [{ floodEvents: floodEvents.length, gdacs: gdacsFlood.length, rainScore: Math.round(rainScore) }],
  };
}

export function scoreDrought(input: RiskInput): RiskScore {
  const { polygon, droughtCells } = input;
  const cells = droughtCells.filter((c) => polygonIntersects(c.geometry, polygon));
  const score = cells.length ? clamp(cells.reduce((s, c) => s + c.riskScore, 0) / cells.length) : 25;
  const drivers: string[] = [];
  if (cells.length) drivers.push(`Rainfall anomaly avg ${Math.round(cells.reduce((s, c) => s + c.anomalyPercent, 0) / cells.length)}% across ${cells.length} grid cells`);
  else drivers.push("No CHIRPS cells intersect zone");
  drivers.push("Reanalysis data — daily update cadence");
  return {
    hazard: "drought",
    score: Math.round(score),
    confidence: 0.65,
    level: riskLevelFromScore(score),
    drivers,
    evidence: [{ cells: cells.length }],
  };
}

export function scoreLandslide(input: RiskInput): RiskScore {
  const { polygon, weather, buildings } = input;
  const rainScore = weather ? clamp(weather.precipitationMm * 10 + weather.forecastHours.slice(0, 12).reduce((s, h) => s + h.precipMm, 0) * 2) : 30;
  const exposure = buildings.features.filter((b) => b.geometry.type === "Polygon" && polygonIntersects(b.geometry as GeoJSON.Polygon, polygon)).length;
  const exposureScore = clamp(exposure / 3, 0, 100);
  const score = clamp(0.55 * rainScore + 0.45 * exposureScore);
  const drivers = [
    weather ? `Rainfall intensity ${weather.precipitationMm}mm (24h forecast ${weather.forecastHours.slice(0, 12).reduce((s, h) => s + h.precipMm, 0).toFixed(1)}mm)` : "No weather data",
    "No local geology/soil/slope data — confidence low",
  ];
  return { hazard: "landslide", score: Math.round(score), confidence: 0.45, level: riskLevelFromScore(score), drivers, evidence: [{ rainScore: Math.round(rainScore) }] };
}

export function scoreCyclone(input: RiskInput): RiskScore {
  const { polygon, events, buildings } = input;
  const cyclones = eventsIn(events, polygon, "cyclone", 150);
  const score = cyclones.length ? clamp(cyclones.reduce((s, e) => s + e.severity, 0) / cyclones.length * 0.8 + 15) : 15;
  const drivers = cyclones.length ? [`${cyclones.length} cyclone/storm system(s) within 150km`, "Track + wind intensity from GDACS"] : ["No active cyclone tracks within 150km"];
  const exposure = buildings.features.filter((b) => b.geometry.type === "Polygon" && polygonIntersects(b.geometry as GeoJSON.Polygon, polygon)).length;
  if (exposure > 0) drivers.push(`~${exposure} building footprints in zone`);
  return { hazard: "cyclone", score: Math.round(score), confidence: 0.8, level: riskLevelFromScore(score), drivers, evidence: [{ cyclones: cyclones.length }] };
}

export function scoreHeat(input: RiskInput): RiskScore {
  const { weather } = input;
  const score = weather ? clamp((weather.temperatureC - 20) * 3 + (weather.humidity < 30 ? 15 : 0)) : 25;
  return { hazard: "heat", score: Math.round(score), confidence: 0.85, level: riskLevelFromScore(score), drivers: weather ? [`Temp ${weather.temperatureC.toFixed(0)}°C, humidity ${weather.humidity}%`] : ["No weather data"], evidence: [] };
}

export function scoreAirQuality(input: RiskInput): RiskScore {
  const { events, polygon } = input;
  const fires = eventsIn(events, polygon, "wildfire", 50);
  const score = fires.length ? clamp(30 + fires.length * 6) : 20;
  return { hazard: "air_quality", score: Math.round(score), confidence: 0.6, level: riskLevelFromScore(score), drivers: fires.length ? [`${fires.length} fire detections within 50km (smoke proxy)`] : ["Limited air-quality station coverage"], evidence: [{ fires: fires.length }] };
}

type RiskEvent = RiskScore;

export function computeRiskScores(input: RiskInput): RiskScore[] {
  const out: RiskScore[] = [];
  for (const h of input.hazards) {
    switch (h) {
      case "wildfire": out.push(scoreWildfire(input)); break;
      case "earthquake": out.push(scoreEarthquake(input)); break;
      case "flood": out.push(scoreFlood(input)); break;
      case "drought": out.push(scoreDrought(input)); break;
      case "landslide": out.push(scoreLandslide(input)); break;
      case "cyclone": out.push(scoreCyclone(input)); break;
      case "heat": out.push(scoreHeat(input)); break;
      case "air_quality": out.push(scoreAirQuality(input)); break;
      default: break;
    }
  }
  return out;
}

export function overallRisk(scores: RiskScore[]): number {
  if (!scores.length) return 0;
  return Math.round(scores.reduce((s, r) => s + r.score, 0) / scores.length);
}
export function overallConfidence(scores: RiskScore[]): number {
  if (!scores.length) return 0;
  return Number((scores.reduce((s, r) => s + r.confidence, 0) / scores.length).toFixed(2));
}

// --- geometry helpers local to engine ---
function polygonIntersects(a: GeoJSON.Polygon, b: GeoJSON.Polygon): boolean {
  // cheap test: any vertex of a inside b, or bbox overlap
  try {
    const ring = a.coordinates[0];
    for (const p of ring) if (pointInPolygon(p as [number, number], b)) return true;
    const ring2 = b.coordinates[0];
    for (const p of ring2) if (pointInPolygon(p as [number, number], a)) return true;
    return bboxOverlap(bboxOf(a), bboxOf(b));
  } catch {
    return false;
  }
}
function bboxOverlap(a: number[], b: number[]): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}
function polygonCenter(poly: GeoJSON.Polygon): [number, number] {
  const ring = poly.coordinates[0];
  const lng = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const lat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  return [lng, lat];
}
function clamp01(n: number) { return Math.max(0, Math.min(1, n)); }

export { polygonIntersects, polygonCenter };
export { areaKm2 };
