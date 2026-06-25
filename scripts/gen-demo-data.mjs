// Deterministic demo-data generator for DisasterOS.
// Run: node scripts/gen-demo-data.mjs
import { writeFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "data", "demo");
mkdirSync(OUT, { recursive: true });

// Seeded PRNG
let _s = 1337;
function rnd() {
  _s = (_s * 1664525 + 1013904223) % 4294967296;
  return _s / 4294967296;
}
function pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }
function rand(min, max) { return min + rnd() * (max - min); }
function iso(daysAgo = 0, hoursAgo = 0) {
  const d = new Date(Date.now() - daysAgo * 86400000 - hoursAgo * 3600000 - Math.floor(rnd() * 3600000));
  return d.toISOString();
}
function write(name, data) {
  writeFileSync(path.join(OUT, name), JSON.stringify(data, null, 2));
  console.log("wrote", name, Array.isArray(data) ? `(${data.length})` : "");
}

// ---- 1. NASA FIRMS wildfire points (Kenya/Somalia border + Southern Somalia) ----
const firmsClusters = [
  [40.8, 0.4], [41.2, 0.1], [40.4, 0.9], [43.1, 2.8], [43.9, 1.8], [42.6, 3.1],
];
const firms = [];
for (let i = 0; i < 48; i++) {
  const c = pick(firmsClusters);
  const lng = c[0] + rand(-0.35, 0.35);
  const lat = c[1] + rand(-0.3, 0.3);
  const frp = rand(10, 320);
  const confRaw = pick(["l", "l", "n", "n", "h", "h"]);
  const conf = confRaw === "h" ? rand(0.8, 0.98) : confRaw === "n" ? rand(0.5, 0.8) : rand(0.3, 0.55);
  firms.push({
    id: `firms_${i}`,
    type: "wildfire",
    source: "NASA_FIRMS",
    geometry: { type: "Point", coordinates: [lng, lat] },
    severity: Math.min(100, Math.round((frp / 320) * 90 + rand(5, 15))),
    confidence: Number(conf.toFixed(2)),
    observedAt: iso(0, Math.floor(rand(0, 18))),
    properties: {
      brightness: Math.round(rand(300, 360)),
      frp: Number(frp.toFixed(1)),
      satellite: pick(["Aqua", "Terra", "SNPP", "NOAA-20"]),
      instrument: pick(["MODIS", "VIIRS"]),
      confidenceRaw: confRaw,
    },
  });
}
write("firms_somalia_kenya.json", firms);

// ---- 2. USGS earthquakes ----
const quakes = [
  { lat: 28.2, lng: 84.5, mag: 5.4, depth: 12, place: "Nepal" },
  { lat: 36.2, lng: -118.4, mag: 3.8, depth: 8, place: "California" },
  { lat: 12.0, lng: 124.0, mag: 4.6, depth: 30, place: "Philippines" },
  { lat: -2.5, lng: 118.0, mag: 6.1, depth: 20, place: "Sulawesi" },
  { lat: 38.2, lng: 23.5, mag: 4.2, depth: 15, place: "Greece" },
  { lat: 0.4, lng: 40.8, mag: 4.4, depth: 18, place: "Kenya/Somalia border" },
  { lat: 35.5, lng: 139.5, mag: 5.0, depth: 40, place: "Japan" },
  { lat: -33.0, lng: -71.0, mag: 4.9, depth: 25, place: "Chile" },
  { lat: 19.4, lng: -99.1, mag: 3.5, depth: 10, place: "Mexico" },
  { lat: 60.0, lng: -150.0, mag: 4.1, depth: 50, place: "Alaska" },
  { lat: 41.0, lng: 14.0, mag: 3.2, depth: 9, place: "Italy" },
  { lat: 28.8, lng: 85.3, mag: 4.8, depth: 14, place: "Nepal" },
];
write("usgs_recent.json", quakes.map((q, i) => ({
  id: `usgs_${i}`,
  type: "earthquake",
  source: "USGS",
  geometry: { type: "Point", coordinates: [q.lng, q.lat] },
  severity: Math.min(100, Math.round((q.mag / 7) * 100)),
  confidence: 0.95,
  observedAt: iso(Math.floor(rand(0, 2)), Math.floor(rand(0, 20))),
  properties: { magnitude: q.mag, depthKm: q.depth, place: q.place, url: `https://earthquake.usgs.gov/earthquakes/eventpage/us${7000 + i}` },
})));

// ---- 3. GDACS alerts ----
const gdacs = [
  { type: "cyclone", title: "Tropical Cyclone NALGAE", lat: 12.5, lng: 124.2, sev: 78, alert: "Orange" },
  { type: "flood", title: "Flood Alert - Juba River", lat: 1.8, lng: 42.6, sev: 62, alert: "Green" },
  { type: "drought", title: "Drought Alert - Horn of Africa", lat: 2.5, lng: 43.5, sev: 71, alert: "Orange" },
  { type: "earthquake", title: "M5.4 Nepal", lat: 28.2, lng: 84.5, sev: 48, alert: "Green" },
  { type: "flood", title: "Flood Alert - Visayas", lat: 11.0, lng: 123.5, sev: 66, alert: "Orange" },
  { type: "volcano", title: "Volcanic Activity - Mayon", lat: 13.3, lng: 123.7, sev: 55, alert: "Green" },
  { type: "severe_weather", title: "Severe Weather - Bay of Bengal", lat: 15.0, lng: 88.0, sev: 58, alert: "Green" },
  { type: "drought", title: "Drought Stress - Eritrea", lat: 15.5, lng: 38.5, sev: 60, alert: "Orange" },
];
write("gdacs_alerts.json", gdacs.map((g, i) => ({
  id: `gdacs_${i}`,
  type: g.type,
  source: "GDACS",
  geometry: { type: "Point", coordinates: [g.lng, g.lat] },
  severity: g.sev,
  confidence: 0.8,
  observedAt: iso(Math.floor(rand(0, 1))),
  properties: { title: g.title, alertLevel: g.alert, url: `https://www.gdacs.org/report.aspx?eventid=${1000 + i}` },
})));

// ---- 4. Weather sample (Southern Somalia) ----
const forecastHours = [];
for (let h = 0; h < 24; h++) {
  forecastHours.push({
    time: new Date(Date.now() + h * 3600000).toISOString(),
    tempC: Number(rand(26, 38).toFixed(1)),
    precipMm: Number(rand(0, 3).toFixed(1)),
    windKmh: Number(rand(8, 32).toFixed(1)),
  });
}
write("weather_somalia_sample.json", {
  lat: 2.5, lng: 43.5,
  temperatureC: 34.2, humidity: 28, windSpeedKmh: 22, windDirection: 210,
  precipitationMm: 0.4, forecastHours, updatedAt: iso(),
});

// ---- 5. CHIRPS drought cells (East Africa grid) ----
const droughtCells = [];
for (let lat = -1.5; lat <= 4.5; lat += 0.5) {
  for (let lng = 40.5; lng <= 46.0; lng += 0.5) {
    const anom = rand(-65, 5);
    const risk = Math.max(5, Math.min(95, Math.round(50 + (-anom) * 0.6)));
    droughtCells.push({
      cellId: `chirps_${lat.toFixed(1)}_${lng.toFixed(1)}`,
      hazard: "drought",
      riskScore: risk,
      anomalyPercent: Number(anom.toFixed(0)),
      confidence: 0.62,
      updatedAt: iso(1),
      geometry: {
        type: "Polygon",
        coordinates: [[
          [lng, lat], [lng + 0.5, lat], [lng + 0.5, lat + 0.5],
          [lng, lat + 0.5], [lng, lat],
        ]],
      },
    });
  }
}
write("chirps_drought_cells.json", droughtCells);

// ---- 6. OSM buildings sample (clusters inside border + S. Somalia) ----
function buildingFootprint(lng, lat, sizeM = 45) {
  const dLat = (sizeM / 111000);
  const dLng = (sizeM / 111000) / Math.cos((lat * Math.PI) / 180);
  const rot = rnd() * Math.PI;
  const w = dLng * rand(0.6, 1.2);
  const h = dLat * rand(0.6, 1.2);
  const cx = lng, cy = lat;
  const corners = [[-w, -h], [w, -h], [w, h], [-w, h], [-w, -h]].map(([x, y]) => {
    const rx = x * Math.cos(rot) - y * Math.sin(rot);
    const ry = x * Math.sin(rot) + y * Math.cos(rot);
    return [Number((cx + rx).toFixed(6)), Number((cy + ry).toFixed(6))];
  });
  return { type: "Polygon", coordinates: [corners] };
}
const buildClusters = [
  { c: [40.8, 0.4], n: 70 }, { c: [41.3, 0.0], n: 55 },
  { c: [43.4, 2.6], n: 60 }, { c: [43.9, 1.9], n: 45 },
];
const buildings = [];
let bi = 0;
for (const cl of buildClusters) {
  for (let i = 0; i < cl.n; i++) {
    const lng = cl.c[0] + rand(-0.12, 0.12);
    const lat = cl.c[1] + rand(-0.1, 0.1);
    const size = rand(25, 90);
    buildings.push({
      type: "Feature",
      id: `bld_${bi}`,
      geometry: buildingFootprint(lng, lat, size),
      properties: {
        id: `bld_${bi}`,
        source: "OSM",
        building: pick(["yes", "house", "residential", "commercial", "school", "clinic"]),
        areaM2: Number((size * size).toFixed(0)),
        confidence: Number(rand(0.6, 0.95).toFixed(2)),
      },
    });
    bi++;
  }
}
write("osm_buildings_sample.geojson", { type: "FeatureCollection", features: buildings });

// ---- 7. OSM roads sample ----
const roads = [];
const roadClusters = [
  { c: [40.8, 0.4] }, { c: [43.5, 2.5] }, { c: [41.3, 0.0] },
];
for (let i = 0; i < 36; i++) {
  const cl = pick(roadClusters);
  const segs = [];
  let lng = cl.c[0] + rand(-0.15, 0.15);
  let lat = cl.c[1] + rand(-0.12, 0.12);
  const n = Math.floor(rand(3, 8));
  for (let j = 0; j < n; j++) {
    lng += rand(-0.02, 0.02);
    lat += rand(-0.02, 0.02);
    segs.push([Number(lng.toFixed(6)), Number(lat.toFixed(6))]);
  }
  roads.push({
    type: "Feature",
    id: `road_${i}`,
    geometry: { type: "LineString", coordinates: segs },
    properties: {
      id: `road_${i}`,
      highway: pick(["residential", "tertiary", "secondary", "primary", "track", "unclassified"]),
      name: pick(["", "", "Main Rd", "Shabelle Rd", "Juba Rd", "Access Rd"]),
    },
  });
}
write("osm_roads_sample.geojson", { type: "FeatureCollection", features: roads });

// ---- 8. Critical facilities ----
const facilities = [];
const facTypes = [
  { t: "school", amenity: "school", n: 10 },
  { t: "hospital", amenity: "hospital", n: 4 },
  { t: "clinic", amenity: "clinic", n: 6 },
  { t: "shelter", amenity: "shelter", n: 5 },
];
let fi = 0;
for (const ft of facTypes) {
  for (let i = 0; i < ft.n; i++) {
    const cl = pick(buildClusters);
    const lng = cl.c[0] + rand(-0.13, 0.13);
    const lat = cl.c[1] + rand(-0.11, 0.11);
    facilities.push({
      type: "Feature",
      id: `fac_${fi}`,
      geometry: { type: "Point", coordinates: [lng, lat] },
      properties: {
        id: `fac_${fi}`,
        type: ft.t,
        amenity: ft.amenity,
        name: `${ft.t[0].toUpperCase() + ft.t.slice(1)} ${fi}`,
        emergency: ft.t === "shelter" ? "assembly_point" : undefined,
      },
    });
    fi++;
  }
}
write("critical_facilities_sample.geojson", { type: "FeatureCollection", features: facilities });

// ---- 9. Risk cells (East Africa) ----
const riskCells = [];
for (let lat = -1.5; lat <= 4.5; lat += 0.4) {
  for (let lng = 40.5; lng <= 46.0; lng += 0.4) {
    const wf = Math.max(5, Math.min(95, Math.round(rand(10, 80))));
    const dr = Math.max(5, Math.min(95, Math.round(50 + rand(-25, 30))));
    riskCells.push({
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [[
          [lng, lat], [lng + 0.4, lat], [lng + 0.4, lat + 0.4],
          [lng, lat + 0.4], [lng, lat],
        ]],
      },
      properties: {
        wildfire: wf,
        drought: dr,
        flood: Math.max(5, Math.min(70, Math.round(rand(5, 60)))),
        overall: Math.round((wf + dr) / 2),
      },
    });
  }
}
write("risk_cells_east_africa.geojson", { type: "FeatureCollection", features: riskCells });

console.log("\nAll demo data written to", OUT);
