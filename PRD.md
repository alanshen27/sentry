# Sentry — Product Requirements Document (Reconstruction Spec)

> **Purpose of this document:** a single, self-contained specification detailed enough that an engineer (or an LLM) can reconstruct the Sentry application from scratch. It captures product intent, architecture, data model, algorithms, API contracts, UI behavior, and visual design. Where exact constants matter (weights, colors, thresholds), they are stated explicitly.

**Tagline:** _Draw any region. Monitor every disaster signal. Confidence-aware intelligence._

---

## 1. Product Overview

Sentry is a geospatial **disaster operations intelligence** platform for disaster-response coordinators, humanitarian/NGO field teams, emergency-management analysts, and operations leadership. It unifies live multi-hazard feeds, OpenStreetMap exposure data, and AI-assisted analysis into one interactive map "command center."

The core loop: **draw or select a region → analyze risk & exposure → review sector breakdown & AI brief → save as a watch zone with triggers → evaluate triggers → respond to alerts.**

Sentry is **decision support**, not an official warning system. Every output carries confidence signals and explicit data-gap reporting. Building-state estimates are deterministic proxies, not field-verified damage assessments.

### Primary user value
1. **Region-first analysis** — analyze any drawn polygon, not just predefined areas.
2. **Multi-hazard, one view** — wildfire, earthquake, flood, drought, cyclone, landslide, heat, air quality (+ volcano, tsunami, severe weather types).
3. **Actionable exposure** — buildings, roads, schools, hospitals, shelters, population estimates clipped to the region.
4. **Confidence-aware output** — 0–100 scores with Low/Moderate/High/Severe levels, per-hazard drivers, and source health.
5. **Automated monitoring** — saved watch zones + plain-language trigger rules + severity-ranked alerts with optional AI briefs.

---

## 2. Technology Stack

| Layer | Technology | Version (from `package.json`) |
|---|---|---|
| Framework | Next.js (App Router) | 14.2.15 |
| UI runtime | React / React DOM | 18.3.1 |
| Map | MapLibre GL JS | 4.7.1 |
| Geospatial | Turf.js modular packages | 7.1.0 (`area`, `bbox`, `boolean-point-in-polygon`, `buffer`, `center`, `distance`, `helpers`, `intersect`, `length`, `points-within-polygon`, `square-grid`) |
| State | Zustand | 5.0.1 |
| Styling | Tailwind CSS + `tailwindcss-animate` + `class-variance-authority` + `clsx` + `tailwind-merge` | TW 3.4.14 |
| UI primitives | Radix UI (dialog, label, popover, select, separator, slot, switch, tabs, tooltip) | 1.x/2.x |
| Icons | `lucide-react` | 0.454.0 |
| Charts | `recharts` | 2.13.0 |
| DB ORM | Prisma + `@prisma/client` | 6.19.3 |
| Database | PostgreSQL | — |
| Auth | Supabase (`@supabase/ssr`, `@supabase/supabase-js`) | 0.12 / 2.108 |
| Cache | Redis (`ioredis`) | 5.11 (optional) |
| LLM | OpenAI SDK (`openai`), OpenAI or OpenRouter | 6.44 |
| Misc | `bcryptjs`, `jose`, `nanoid` | — |

**Scripts:** `dev` (`next dev`), `build` (`next build`), `start` (`next start`), `lint` (`next lint`), `typecheck` (`tsc --noEmit`).

**Path alias:** `@/*` → repo root.

---

## 3. Repository / File Structure

```
app/
  layout.tsx                 # root layout: fonts, theme no-flash script, ThemeProvider, AppShell, Toaster
  globals.css                # Tailwind layers + CSS variable palettes (light :root / dark .dark) + MapLibre overrides
  page.tsx                   # root command-center entry (redirects/renders CommandCenterPage)
  w/[workspaceSlug]/         # workspace-scoped command center route (layout + page)
  login/ signup/ setup/ configure/   # auth + onboarding pages (bare, no app chrome)
  zones/ alerts/ projects/ settings/ # secondary pages
  api/                       # Next.js route handlers (see §11)

components/
  app-shell.tsx              # chooses bare vs chrome layout; wraps WorkspaceProvider + TopBar
  workspace-provider.tsx     # loads user + workspaces; provides ready/user/workspaces/reloadWorkspaces
  theme-provider.tsx         # light/dark context + toggle, persists to localStorage
  top-bar.tsx                # workspace/project pickers, layer tabs (create/edit/delete/toggle), nav, theme toggle
  command-center-page.tsx    # orchestrates map + sidebar + inspector + dialogs + feed; owns analysis/marker flows
  map-command-center.tsx     # MapLibre map: sources, layers, draw/edit tools, basemap/theme, marker/hazard rendering
  hazard-layer-sidebar.tsx   # left sidebar: hazard feed legend toggles, exposure overlays, project artifacts
  watch-zone-inspector.tsx   # right resizable panel: empty state, analysis results, Analyze/Deep Analyze, trigger
  project-artifacts-panel.tsx# regions/markers/segments lists with rename/delete/move-to-layer
  analyze-region-dialog.tsx  # "Where do you want to analyze?" (saved/demo/draw)
  marker-panel.tsx           # bottom-left marker drafts list + editor
  trigger-builder.tsx        # programmable trigger rule dialog
  alert-feed.tsx             # EventTimeline (reads store.feed) + AlertFeed (reads /api/alerts)
  risk-cards.tsx exposure-panel.tsx llm-brief-card.tsx deep-analysis-panel.tsx
  pending-marker-import.tsx  # filter + import building-footprint markers into a layer
  data-source-status.tsx limitations-card.tsx collapsible-section.tsx
  saved-regions-panel.tsx onboarding-dialog.tsx workspace-gate.tsx logo.tsx layer-color-picker.tsx
  ui/                        # shadcn-style primitives (button, card, badge, input, label, dialog, select, switch, toaster, ...)

lib/
  types.ts                   # all core domain types + HAZARD_LABELS/COLORS, RISK_LEVEL_COLORS, helpers
  store/useAppStore.ts       # Zustand global store (map/draw/analysis/feed/layers state)
  layers.ts                  # hazard toggle ↔ hazard type mapping + event filtering
  artifact-layers.ts         # artifact visibility filter (eye toggle + active layer focus)
  polygon-edit.ts            # ring open/close, vertex snapping
  geo.ts                     # turf wrappers: bbox, area, point-in-polygon, distance, buffer, downwind buffer
  utils.ts                   # cn(), uid(), timeAgo()
  map/icons.ts               # lucide → canvas map badges/glyphs + SVG markup for popups/legend
  risk/                      # index.ts (analyzeRegion), engine.ts (per-hazard scoring), segment.ts, exposure.ts
  sources/                   # index.ts orchestrator + firms, usgs, gdacs, chirps, openmeteo, osm, ohsome
  osm/clip.ts                # clip OSM FeatureCollections to a polygon
  ingest/                    # worker.ts (background loop), firms.ts, gdacs.ts
  llm/                       # provider.ts, prompt.ts, generateBrief.ts, houseEval.ts
  markers/                   # constants.ts, label.ts, summary.ts
  cache/index.ts             # Redis (optional) cache helper
  db/                        # index.ts (getRepo/dbMode), repository.ts (interface + record types), prisma.ts, prisma-repo.ts
  auth/                      # context.ts (getApiUser/ensureWorkspaceId/cookies), supabase.ts, client.ts
  workspaces/routes.ts       # workspacePath(slug), isWorkspaceRoute(path)
  demo-regions.ts            # DEMO_REGIONS presets

prisma/schema.prisma         # Postgres schema (see §5)
```

---

## 4. Configuration & Environment

All hazard data can run from cached/keyless feeds; only Postgres + Supabase are required for full functionality.

| Variable | Purpose | Behavior if absent |
|---|---|---|
| `DATABASE_URL` | Postgres connection (pooled) | **Required.** `getRepo()` throws — there is no JSON fallback. |
| `DIRECT_URL` | Prisma direct connection (migrations) | Recommended for Supabase pooling. |
| Supabase env (URL + anon key) | Auth session | Auth required for API routes. |
| `FIRMS_MAP_KEY` | NASA FIRMS live wildfire detections | FIRMS skipped in ingest; cached snapshot used at read. |
| `OPENAI_API_KEY` | LLM briefs (preferred) | Deep Analyze brief errors; **Analyze** still uses deterministic brief. |
| `OPENAI_MODEL` | OpenAI model | Defaults to `gpt-4o-mini`. |
| `OPENROUTER_API_KEY` | LLM via OpenRouter (fallback provider) | — |
| `OPENROUTER_MODEL` | OpenRouter model | Defaults to `openai/gpt-4o-mini`. |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | optional basemap token | Not required (CARTO/Esri rasters used). |
| `INGEST_INTERVAL_MS` | background ingest cadence | Defaults to 300000 (5 min). |

LLM provider resolution: `OPENAI_API_KEY` wins, else `OPENROUTER_API_KEY`, else none. Temperature 0.3, default max_tokens 1400.

---

## 5. Data Model (Prisma / Postgres)

Datasource: `postgresql`, `url = env(DATABASE_URL)`, `directUrl = env(DIRECT_URL)`. Generator: `prisma-client-js`.

Entity hierarchy: **Workspace → Project → Layer**, with artifacts (Segment, Marker, WatchZone) under a project and optionally a layer.

| Model | Key fields | Notes |
|---|---|---|
| `User` | id(cuid), email(unique), passwordHash?, name?, role(default `analyst`: admin/analyst/viewer) | Supabase auth ids upserted here before FK inserts. |
| `Workspace` | id, name, slug(unique), ownerId | Has members, projects, triggers, alerts. |
| `WorkspaceMember` | (workspaceId,userId) composite id, role | Cascade delete with workspace/user. |
| `Project` | id, workspaceId, ownerId, name, description?, defaultLat/Lng/Zoom | Has layers, segments, markers, zones, snapshots. |
| `Layer` | id, projectId, name, description?, type(default `overlay`: overlay/segment/marker/reference), color(`#38bdf8`), visible(true), locked(false) | Cascade delete with project; artifacts SetNull on layer delete. |
| `Segment` | id, projectId, layerId?, workspaceId, geometry(Json Polygon), label?, color, state(draft/active/archived), riskScore?, notes?, createdBy | |
| `Marker` | id, projectId, layerId?, workspaceId, geometry(Json Point), label?, color(`#f97316`), state(pending/verified/damaged/destroyed/unknown/safe), category(house/school/hospital/shelter/observation/fire/flood/custom...), sizeM2?, confidence?, source(user/llm/vision/firms/usgs), notes?, createdBy | |
| `WatchZone` | id, projectId?, layerId?, workspaceId, ownerId, name, geometry(Json Polygon), hazards(Json HazardType[]), notes? | Has triggers + snapshots. |
| `TriggerRule` | id, workspaceId, zoneId?, name, hazard, metric, operator, threshold, durationMinutes(0), cooldownMinutes(30), actions(Json), naturalLanguage, enabled(true), lastFired? | |
| `AlertRecord` | id, workspaceId, triggerId?, zoneId?, userId?, triggerName, zoneName?, hazard, message, severity, brief(Json?), actions(Json), acknowledged(false) | |
| `AnalysisSnapshot` | id, zoneId?, projectId?, result(Json AnalysisResult) | Written on each analyze call. |
| `ApiKey` | id, userId, provider(openai/anthropic/openrouter/firms), maskedKey, unique(userId,provider) | |
| `HazardEventRecord` | id, source(USGS/NASA_FIRMS/GDACS), sourceId, type(HazardType), geometry(Json Point), severity, confidence, observedAt, properties(Json), unique(source,sourceId) | Shared/ingested; read by all users. |
| `IngestRun` | id, source, count, ok, error?, startedAt, finishedAt? | Ingest audit log. |

The **Repository interface** (`lib/db/repository.ts`) is the abstraction over persistence (currently Prisma-backed; `dbMode()` returns `"prisma"`). It exposes CRUD for all of the above plus: `upsertUser`, `listWorkspaces`, `createWorkspace`, project/layer/segment/marker CRUD, `bulkCreateMarkers`, `bulkAssignMarkersToLayer`, zone CRUD, trigger CRUD, alert create/list/acknowledge, snapshot create/list, api-key upsert/list, and ingest helpers (`upsertHazardEvents`, `listHazardEvents`, `hazardEventStats`, `recordIngestRun`, `listIngestRuns`).

---

## 6. Core Domain Types (`lib/types.ts`)

```ts
type HazardType = "wildfire"|"earthquake"|"flood"|"drought"|"cyclone"|"landslide"|"heat"|"air_quality"|"volcano"|"tsunami"|"severe_weather";
type RiskLevel = "Low"|"Moderate"|"High"|"Severe";
type ConfidenceLabel = "High"|"Medium"|"Low";

interface HazardEvent { id; type:HazardType; source; geometry:GeoJSON.Geometry; severity:0..100; confidence:0..1; observedAt; properties? }
interface WeatherSignal { lat; lng; temperatureC; humidity; windSpeedKmh; windDirection; precipitationMm; forecastHours:{time,tempC,precipMm,windKmh}[]; updatedAt }
interface TriggerAction { type:"dashboard_alert"|"email"|"sms"|"webhook"|"llm_brief"|"incident_task"; target? }
interface TriggerRule { id; zoneId?; name; hazard; metric; operator:">"|">="|"<"|"<="|"=="|"change_gt"; threshold; durationMinutes; cooldownMinutes; actions:TriggerAction[]; enabled; createdAt; lastFired?; naturalLanguage }
interface RiskScore { hazard:HazardType; score:0..100; confidence:0..1; level:RiskLevel; drivers:string[]; evidence:any[] }
interface Sector { id; geometry:Polygon; riskByHazard:Partial<Record<HazardType,number>>; overallRisk; exposedBuildings; roadLengthKm; criticalAssets; populationEstimate; confidence; center:[lng,lat] }
interface ExposedAssets { buildings; roadLengthKm; schools; hospitals; clinics; shelters; waterPoints; policeStations; fireStations; populationEstimate; criticalFacilities:CriticalFacility[]; roads:{id,name,lengthKm}[] }
interface CriticalFacility { id; type:"school"|"hospital"|"clinic"|"shelter"|"water_point"|"police"|"fire_station"; name; geometry:Point; tags? }
interface WatchZone { id; name; geometry:Polygon; createdAt; hazards:HazardType[]; triggers:TriggerRule[]; notes?; layerId?; projectId? }
interface AnalysisResult { zone:WatchZone; sectors:Sector[]; riskScores:RiskScore[]; overallRisk; overallConfidence; exposedAssets; brief:BriefResult; sources:SourceStatus[]; updatedAt }
interface BriefResult { text; sections:{heading,body}[]; generatedAt; model; provider:"openai"|"openrouter"|"mock"|"computed"; suggestedAlerts:string[] }
interface SourceStatus { id; name; state:"connected"|"cached_fallback"|"failed"|"needs_api_key"; lastUpdated; detail? }
interface DroughtCell { cellId; hazard:"drought"; riskScore; anomalyPercent; confidence; updatedAt; geometry:Polygon }
interface FeedEvent { id; type:"firms_detection"|"earthquake"|"rainfall_anomaly"|"wind_spike"|"trigger_fired"|"llm_brief"|"deep_analysis"|"system"; message; severity:"info"|"warning"|"critical"; timestamp; meta? }
interface AlertRecord { id; triggerId; triggerName; zoneId?; zoneName?; hazard; message; severity:RiskLevel; brief?; timestamp; acknowledged; actions:TriggerAction[] }
```

**Constants/helpers:** `HAZARD_LABELS`, `HAZARD_COLORS`, `RISK_LEVEL_COLORS`, `riskLevelFromScore(score)` (≤25 Low, ≤50 Moderate, ≤75 High, else Severe), `confidenceLabel(c)` (≥0.7 High, ≥0.4 Medium, else Low).

`HAZARD_COLORS`: wildfire `#ef4444`, earthquake `#a78bfa`, flood `#38bdf8`, drought `#d97706`, cyclone `#06b6d4`, landslide `#f59e0b`, heat `#fb7185`, air_quality `#94a3b8`, volcano `#dc2626`, tsunami `#0ea5e9`, severe_weather `#818cf8`.
`RISK_LEVEL_COLORS`: Low `#22c55e`, Moderate `#eab308`, High `#f97316`, Severe `#ef4444`.

---

## 7. Architecture & Request Flow

```
                 ┌──────────── Background ingest worker (5 min) ────────────┐
   USGS / GDACS ─┤  runIngest() → repo.upsertHazardEvents() → HazardEventRecord │
   NASA FIRMS* ──┘                                                              │
                                                                               ▼
Client (React/Zustand) ── fetch ──▶ Next API routes ──▶ lib/risk.analyzeRegion ──▶ lib/sources/* (live+cache)
        │                                  │                    │
        │                                  │                    ├─ engine.computeRiskScores (per hazard)
        │                                  │                    ├─ segment.segmentRegion (grid)
        │                                  │                    └─ exposure.computeExposedAssets (clipped OSM)
        │                                  ▼
        │                          lib/llm.generateBrief (deep) / buildDeterministicBrief
        ▼
   MapLibre map + inspector render AnalysisResult; snapshot persisted
```

- **Server source-of-truth:** Postgres via Prisma. Hazard events are ingested into a shared table, independent of workspace.
- **Statelessness:** API routes are request-scoped; auth from Supabase session cookie; active workspace/project read from cookies `dos_workspace` / `dos_project`.

---

## 8. Data Sources & Ingest

`lib/sources/index.ts` orchestrates; each source returns `{ events|signal|data, status: SourceStatus }` and degrades to cached snapshots on failure.

| Source | Hazards | Auth | Notes |
|---|---|---|---|
| NASA FIRMS (`firms.ts`) | wildfire | `FIRMS_MAP_KEY` | Live only if key present; bounded by region bboxes in ingest; cached snapshot otherwise. |
| USGS (`usgs.ts`) | earthquake | keyless | Global feed; filtered to bbox at read. |
| GDACS (`gdacs.ts`) | flood, cyclone, drought, volcano, tsunami, severe_weather | keyless | `TYPE_MAP` normalizes GDACS event types → HazardType. |
| CHIRPS-derived (`chirps.ts`) | drought (grid cells) | — | Returns `DroughtCell[]` with rainfall anomaly. |
| Open-Meteo (`openmeteo.ts`) | weather context | keyless | temperature, humidity, wind speed/direction, precip, hourly forecast. |
| OSM via ohsome (`osm.ts`/`ohsome.ts`) | buildings, roads, facilities | keyless | ohsome returns latest snapshot (no `time` param — passing today 404s); status reported as `cached_fallback` for the aggregate OSM source. |

- `getAllHazards(bbox)` runs FIRMS/USGS/GDACS in parallel + drought, filters non-FIRMS by bbox, returns combined `events` + `statuses`.
- `getSourcesStatus()` appends synthetic statuses for Open-Meteo (connected), OSM (cached_fallback), and LLM (`connected` if key else `needs_api_key`, detail = provider).
- **Ingest worker** (`lib/ingest/worker.ts`): `startIngestWorker()` guards a single instance; first run after 3s, then every `INGEST_INTERVAL_MS` (default 5 min). Each pass pulls USGS + GDACS (+ FIRMS if keyed), upserts via `repo.upsertHazardEvents`, and records `IngestRun`. Idempotent upserts keyed on `(source, sourceId)`.
- Map hazard refresh on the client: `/api/hazards` polled every **60s**.

---

## 9. Risk Scoring Engine (`lib/risk/engine.ts`)

`computeRiskScores(RiskInput)` dispatches per requested hazard. Common helpers: `eventsIn(events, poly, type, bufferKm)` (point-in-polygon, optionally buffered), `clamp(n,0,100)`, `clamp01`, `polygonIntersects` (cheap vertex-in/bbox-overlap test). Every score returns `{ hazard, score (rounded 0–100), confidence (0–1), level (riskLevelFromScore), drivers[≤5], evidence[] }`.

**Wildfire** (buffer 20 km): weighted blend
`0.35·activeFireScore + 0.20·weatherScore + 0.15·windScore + 0.10·droughtScore + 0.10·exposureScore + 0.10·trendScore`.
- activeFireScore = Σ(severity·confidence)/5, clamped.
- weatherScore from temp (>35→90, >30→70, >25→50, else 30)·0.4 + humidity (<25→90, <40→70, <60→50, else 25)·0.35 + precip (<1→85, <5→55, else 25)·0.25.
- windScore uses `downwindBuffer(fireCenter, windDirection, 25km)` count of buildings in plume; +20 if wind>25 km/h.
- droughtScore from intersecting CHIRPS cells (default 35).
- exposureScore = buildingCount/2.
- trendScore = activeFireScore·0.7 (+20 if >3 fires).
- confidence = (fires?0.35:0.2) + (weather?0.2:0.05) + (osm connected?0.15:0.08) + 0.1.

**Earthquake** (buffer 100 km): pick max-magnitude quake; `score = magScore·distanceDecay·depthFactor·0.7 + exposureScore·0.3` where magScore=(mag/7)·100, distanceDecay=(100−dist·0.5)/100, depthFactor=(100−depthKm)/100, exposureScore=buildings/3. Confidence 0.5. No quakes → score 5, "monitoring only."

**Flood** (buffer 30 km): `0.45·rainScore + 0.25·eventScore + 0.30·exposureScore`; rainScore = precip·12 + (next 6h precip)·3; exposureScore = buildings/2.5. Confidence 0.55 ("no river gauges").

**Drought:** average `riskScore` of intersecting CHIRPS cells (default 25). Confidence 0.65.

**Landslide:** `0.55·rainScore + 0.45·exposureScore`; rainScore = precip·10 + (12h precip)·2; exposure = buildings/3. Confidence 0.45 ("no geology/slope data").

**Cyclone** (buffer 150 km): `avg(severity)·0.8 + 15` if any, else 15. Confidence 0.8.

**Heat:** `(tempC−20)·3 + (humidity<30?15:0)`. Confidence 0.85.

**Air quality:** wildfire smoke proxy (buffer 50 km): `30 + fireCount·6` if fires else 20. Confidence 0.6.

**Aggregates:** `overallRisk` = mean of scores (rounded); `overallConfidence` = mean of confidences (2 dp).

### Sector grid (`lib/risk/segment.ts`)
`segmentRegion(polygon, cellSizeKm, {events,hazards,riskScores,buildings,roads,facilities})` uses a Turf square grid (default cell **8 km** in analyze; **12 km** in trigger evaluation) clipped to the polygon, scoring each cell's `riskByHazard`, `overallRisk`, `exposedBuildings`, `roadLengthKm`, `criticalAssets`, `populationEstimate`, `confidence`, and `center`.

### Exposure (`lib/risk/exposure.ts` + `lib/osm/clip.ts`)
OSM FeatureCollections are clipped to the polygon, then `computeExposedAssets` counts buildings, road length (km), and categorized critical facilities (schools/hospitals/clinics/shelters/water/police/fire), with a population estimate.

### `analyzeRegion` pipeline (`lib/risk/index.ts`)
1. `bbox = bboxOf(geometry)`.
2. Parallel fetch: `getAllHazards(bbox)`, `getWeather(centerLat,centerLng)`, `getOsm(bbox, geometry)`, `getDroughtCells()`.
3. `computeRiskScores`, `segmentRegion`, clip OSM, `computeExposedAssets`.
4. Return `{ riskScores, overallRisk, overallConfidence, sectors, exposedAssets, events, weather, osm, sources, areaKm2, updatedAt }`.

---

## 10. AI Briefing & Building Evaluation (`lib/llm/`, `lib/markers/`)

- **Provider** (`provider.ts`): OpenAI client; if OpenRouter, base URL `https://openrouter.ai/api/v1` with `HTTP-Referer`/`X-Title` headers. `llmComplete(system,user,{maxTokens})` → chat completion, temp 0.3.
- **Deep Analyze brief** (`generateBrief`): builds prompt (`prompt.ts`), parses `## Heading` markdown into `sections`, extracts a trailing `ALERTS: a | b | c` line into `suggestedAlerts` (≤3). Requires an API key (throws otherwise — no mock in production).
- **Deterministic brief** (`buildDeterministicBrief`): no key needed. Produces 7 sections (Executive Summary, Current Risk Level, Most Exposed Sectors, Exposed Assets, Active Events, Data Gaps, Next Steps), `provider: "computed"`, `model: "deterministic"`, and suggested alerts for hazards scoring ≥60.
- **Building evaluation** (`houseEval.ts`): `evaluateBuildings(buildings, riskScores, primaryHazard, sectors)` deterministically assigns each OSM building footprint a marker proposal — estimated `state` (safe/pending/damaged/destroyed/unknown), `category`, `sizeM2`, `color` (`MARKER_STATE_COLORS`), `confidence`, `source: "llm"`. Seeded from hazard exposure + footprint size — **not field-verified**.
- **Summary** (`markers/summary.ts`): `summarizeMarkerEvals(evals)` → `PendingMarkerBreakdown { total, byState, byCategory }`; `filterMarkerEvals(evals, states, categories)` for selective import.

---

## 11. API Surface (Next.js Route Handlers)

All routes require an authenticated Supabase user (`getApiUser()` → 401 `Unauthorized`). Workspace is resolved by `ensureWorkspaceId()` (explicit → cookie → first membership → auto-create). Active project from `dos_project` cookie unless passed explicitly.

| Method + Path | Purpose | Request | Response |
|---|---|---|---|
| `POST /api/analyze-region` | Run region analysis | `{geometry, hazards[], deepAnalysis?, cellSizeKm?, zoneName?, zoneId?, projectId?, layerId?}` | `AnalysisResult` + `{areaKm2, weather, events, osm, pendingMarkerCount, pendingMarkerBreakdown, dbMode}`. Persists `AnalysisSnapshot`. Deep ⇒ LLM brief; else deterministic. |
| `GET /api/hazards` | Map hazard events | — | `{events: HazardEvent[]}` (polled 60s). |
| `GET /api/status` | Source health | — | `SourceStatus[]` via `getSourcesStatus()`. |
| `GET /api/weather` | Weather signal | lat/lng | `WeatherSignal`. |
| `GET /api/osm` | OSM features for bbox/polygon | bbox/polygon | `OsmData`. |
| `POST /api/ingest` | Trigger ingest pass | — | `IngestResult`. |
| `GET/POST /api/workspaces` | List/create workspaces | `{name}` | `{workspaces}` / `{workspace}`. |
| `GET/POST /api/projects` | List/create projects (active workspace) | `{name, description?}` | `{projects}` / `{project}`. |
| `GET/POST /api/layers` | List (by `projectId`) / create | `{projectId, name, color?, type?, description?}` (auto color if absent) | `{layers}` / `{layer}`. |
| `PATCH/DELETE /api/layers/[id]` | Update (name/color/visible) / delete | `{name?,color?,visible?}` | `{layer}` / `{ok}`. |
| `GET/POST /api/zones` | List (workspace, opt projectId/layerId) / create | `{name, geometry, hazards[], projectId?, layerId?, notes?}` | `{zones}` / `{zone}`. |
| `GET/PATCH/DELETE /api/zones/[id]` | Get/update (incl. geometry)/delete | `{name?,geometry?,hazards?,notes?,layerId?}` | `{zone}` / `{ok}`. |
| `GET/POST /api/segments`, `GET/PATCH/DELETE /api/segments/[id]` | Segment CRUD | geometry/label/color/layerId | `{segments|segment|ok}`. |
| `GET/POST /api/markers`, `PATCH/DELETE /api/markers/[id]` | Marker CRUD (filter layerId/state/category/source) | marker fields | `{markers|marker|ok}`. |
| `POST /api/markers/import-buildings` | Bulk-import building footprint markers | `{projectId, layerId?, geometry, hazards[], states?, categories?}` | `{count, markers}` (runs deep analysis + evaluateBuildings + filter + bulkCreate). |
| `POST /api/markers/assign-layer` | Bulk reassign markers to a layer | `{ids[], layerId|null}` | `{count}`. |
| `GET/POST /api/triggers`, `PATCH/DELETE /api/triggers/[id]` | Trigger CRUD | rule fields | `{triggers|trigger|ok}`. |
| `POST /api/triggers/evaluate` | Evaluate enabled zone triggers | `{zoneId?}` | `{fired:[AlertRecord], count, evaluated}`. |
| `GET /api/alerts`, `PATCH /api/alerts/[id]` | List / acknowledge | — | `{alerts}` / `{ok}`. |
| `GET /api/auth/me`, `POST /api/auth/logout` | Session user / logout | — | `{user}` / `{ok}`. |

### Trigger evaluation logic (`/api/triggers/evaluate`)
For each enabled, zone-bound trigger: run `analyzeRegion(zone, cellSizeKm:12)`, compute a **metrics map**:
`risk_score, confidence, exposed_buildings, event_count, severity (max event severity), active_fire_count, earthquake_magnitude, wind_speed, rainfall_24h, drought_anomaly, gdacs_alert_level, trend_change`.
Compare `metrics[metric] (operator) threshold`. If hit **and** cooled (`now - lastFired > cooldownMinutes`), create an `AlertRecord` (severity from overallRisk: ≥76 Severe, ≥51 High, ≥26 Moderate, else Low), optionally attach an LLM brief if action includes `llm_brief`, set `lastFired`, and run mock side-effects (email/sms/webhook are `console.log`).

---

## 12. Auth & Multi-Tenancy

- **Auth:** Supabase. `getSessionUser()` reads the session; `getApiUser()` throws `Unauthorized` (401) when missing.
- **User upsert:** `ensureWorkspaceId()` upserts the Supabase user into the `User` table (so FK inserts succeed), then resolves the active workspace (explicit arg → `dos_workspace` cookie → first membership → auto-created `"{emailLocalPart}'s workspace"`).
- **Active context cookies:** `dos_workspace`, `dos_project` (set client-side on selection, 30-day max-age).
- **Roles:** admin/analyst/viewer at the data-model level (`User.role`, `WorkspaceMember.role`).
- **Bare routes** (no app chrome): `/login`, `/signup`, `/configure` (and onboarding `/setup`). Everything else renders inside `AppShell` (WorkspaceProvider + TopBar).

---

## 13. Frontend State (`lib/store/useAppStore.ts`, Zustand)

Single global store. Key slices:
- **Layers toggles** `LayerToggleState` (wildfire/earthquake/flood/drought/cyclone/landslide/heat/air_quality + osm_buildings/osm_roads/critical_infra/population) with `toggleLayer`, `setLayers`. Defaults: wildfire/earthquake/flood/drought/cyclone true, osm_roads/critical_infra true; rest false.
- **Drawing:** `drawMode: none|polygon|marker|edit`, `vertexRing`, `setVertexRing`, `setDrawMode`.
- **Selection/analysis:** `selectedGeometry`, `selectedZoneId`, `zoneName`, `setSelected(g,name?,id?)` (clears analysis when zone changes), `updateSelectedGeometry`, `analysis`, `analyzing`, `deepAnalysisSteps`, `sectors`, `osmOverlay`.
- **Markers:** `markers: MarkerDraft[]`, `addMarker/updateMarker/removeMarker/setMarkers`.
- **Active context:** `activeWorkspaceId`, `activeProjectId`, `activeLayerId`, `setActive(w?,p?,l?)`.
- **Feed:** `feed: FeedEvent[]` (capped 100), `pushFeed(e)`, and **`logAction(message, {severity?,type?,meta?})`** — the canonical activity logger used across the app. Rendered by `EventTimeline` in the bottom panel between the two side panels.
- **Panels/nonces:** `showMarkerPanel`, `showTriggerBuilder`, `showMapFilters`, and refresh nonces `regionsNonce`/`artifactsNonce`/`layersNonce` with `bumpRegions/bumpArtifacts/bumpLayers`. `projectLayers: ProjectLayerState[]` mirrors top-bar layers for artifact filtering.

**Activity feed coverage (logAction):** region drawn/auto-saved/loaded/renamed/deleted, move-to-layer; markers added/saved/edited/removed/imported; clear selection; analysis & deep analysis; trigger created; layer shown/hidden, layer focus, layer/project/workspace create; workspace/project switch. The feed is in-memory (clears on hard reload; survives `router.push`/`refresh`).

---

## 14. Map (`components/map-command-center.tsx`)

- **Basemap:** raster source `basemap`. Tiles chosen by `tilesFor(basemap, theme)`:
  - `map` + dark → CARTO `dark_all` `@2x`; `map` + light → CARTO `light_all` `@2x` (opacity 0.92).
  - `satellite` → Esri World Imagery `World_Imagery/MapServer/tile/{z}/{y}/{x}` (opacity 1; no key).
  - Switching uses `RasterTileSource.setTiles()` + `setPaintProperty(opacity)` without rebuilding the map. Props: `theme: "light"|"dark"`, `basemap: "map"|"satellite"`.
- **Sources/layers:** `events`, `selected`, `sectors`, `buildings`, `roads`, `facilities`, `markers`, `draw-ring`. Sector fill uses a `step` expression on `risk` (green→amber→orange→red). Selected zone has fill + glow + line (cyan). Draw ring shows line (dashed orange), preview fill, and vertices (cyan if can-close/snap, orange otherwise).
- **Icons** (`lib/map/icons.ts`): lucide icons rendered to canvas via `renderToStaticMarkup` → SVG data URL → `Image` → `addImage`. Registered async on map load before icon layers.
  - **Hazard events** = self-contained pin badges (`haz-<type>`): dark disc `#0b1220`, colored ring (`HAZARD_COLORS`), white lucide glyph. Layer `events-icon` (symbol), sized by severity (0.55–1.0), with a soft `events-glow` circle behind. Icon image = `["concat","haz-",["coalesce",["get","type"],"unknown"]]`.
  - **Markers** = state-colored circle (`markers-circle`, color = state color) + white lucide category glyph on top (`markers-icon`, `cat-<category>`) + label text below + glow. Icon image = `["concat","cat-",["coalesce",["get","category"],"unknown"]]`.
  - Hazard lucide mapping: wildfire→Flame, earthquake→Activity, flood→Droplets, drought→Sun, cyclone→Tornado, landslide→Mountain, heat→ThermometerSun, air_quality→CloudFog, volcano→TriangleAlert, tsunami→Waves, severe_weather→CloudLightning. Category mapping: house/residential→Home, apartments→Building2, school→School, hospital→Cross, clinic→Stethoscope, shelter→Tent, commercial→Store, industrial→Factory, retail→ShoppingBag, church→Church, mosque→Landmark, observation→Eye, fire→Flame, flood→Droplets, custom→MapPin. Exported `hazardIconSvg/markerCategoryIconSvg` produce colored SVG for popups; `hazardIcon/markerCategoryIcon` return lucide components for React (sidebar/inspector).
- **Popups:** hazard popup shows icon + label + severity/100 + source; marker popup shows category icon + label + category·state.
- **Draw/edit tools:** click to add polygon vertices; snap-to-first to close (`SNAP_PX=14`); drag vertices; `Enter` finish, `Esc` cancel; double-click zoom disabled while drawing. Marker mode drops a point on click. Edit mode of a saved zone PATCHes geometry on pointer-up (auto-save) and logs "Region shape saved." Helpers in `lib/polygon-edit.ts`.

---

## 15. Theming (`components/theme-provider.tsx`, `app/globals.css`, `app/layout.tsx`)

- Tailwind `darkMode: ["class"]`. CSS variables: **light palette in `:root`**, **dark palette in `.dark`** (HSL triplets for background/foreground/card/popover/primary/secondary/muted/accent/destructive/border/input/ring + `--radius: 0.5rem`).
- Light: background `210 40% 98%`, foreground `222 47% 11%`, card/popover white, primary `199 89% 48%`, border `214 32% 91%`. Dark: background `222 22% 7%`, foreground `210 20% 92%`, primary `199 89% 52%`, border `222 14% 18%`.
- MapLibre popup/attribution CSS is variable-driven so popups adapt to theme.
- **No-flash:** an inline `<head>` script reads `localStorage["sentry-theme"]` (default `dark`) and toggles `.dark` + `colorScheme` before paint. `ThemeProvider` initializes from the already-applied class, persists changes, and exposes `{theme, setTheme, toggle}`.
- **Toggle:** sun/moon button in the top bar. Theme is independent of basemap (`map`/`satellite`).

---

## 16. Key Screens & UX Flows

**Pages/nav:** Command Center (`/w/:workspace`), Watch Zones & Triggers (`/zones`), Alerts (`/alerts`), Projects (`/projects`), Settings (`/settings`).

**Top bar:** logo; Workspace → Project context pickers (with onboarding prompts when empty); horizontal **layer tabs** ("All" + per-layer) where each tab supports select (focus), hover eye (visibility toggle, persisted via PATCH), and hover pencil (**Edit layer** dialog: rename, recolor via `LayerColorPicker`, two-step delete); nav links; theme toggle; user + logout.

**Left sidebar (`hazard-layer-sidebar`):** collapsible sections — **Hazard feeds** (legend toggles: lucide icon + colored chip + label, mapped to `HAZARD_COLORS`), **Exposure overlays** (buildings/roads/critical infra/population), **Project artifacts** (`ProjectArtifactsPanel`).

**Project artifacts panel:** Regions / Markers / Segments lists. Region rows: select+fly, rename, edit-shape, move-to-layer, delete. Visibility honors `artifactMatchesLayerFilter(layerId, activeLayerId, projectLayers)` — a hidden layer never shows artifacts; an active layer focus isolates to that layer.

**Inspector (`watch-zone-inspector`, right, resizable):**
- Resizable via drag handle + expand button; width persisted in `localStorage["sentry-inspector-width"]` (min 300, max 760, default 340, expanded 560).
- **Empty state:** hero ("Analyze a region" + Choose region button → AnalyzeRegionDialog), a 3-step quick-start (Select/draw → Analyze → Deep Analyze), and a **Live hazards (global)** card listing active event counts with lucide icons + colors. Footer: minimal `DataSourceStatus`.
- **Selected state:** header (zone name, km², hazard count); results when analysis present (RiskScoreCard, HazardScoreList, DeepAnalysisPanel steps, ExposurePanel, CriticalAssetsTable, LLMBriefCard) and a PendingMarkerImport (filter + import building markers into a layer).
- **Actions:** row of `Analyze` / `Deep Analyze`; below, a single full-width **Set alert trigger** button. (No manual Save or Marker buttons — zones auto-save and markers come from the map toolbar.)

**Analyze flow:** `Analyze` (no key needed → deterministic brief, risk, sectors, exposure, building-marker preview) vs **Deep Analyze** (everything + AI 7–11 section brief; requires LLM key). Deep Analyze shows animated step progress.

**Zone auto-save:** finishing a drawn polygon (`onPolygonComplete`) immediately POSTs to `/api/zones` using active project + active layer (+ active hazard types, falling back to `[wildfire,drought,flood]`), stores the returned id, refreshes lists, and logs the action. If no active project, it skips saving and logs a warning.

**Markers:** add via map toolbar (drop point) or import building footprints from analysis; organized into project layers with state color + category icon + label.

**Triggers/alerts:** `TriggerBuilder` composes a rule (hazard, metric, operator, threshold, duration, cooldown, actions) with a natural-language preview; `/api/triggers/evaluate` fires alerts shown in `/alerts`.

**Map toolbar (top-left):** Draw region, Add marker, Done editing (edit mode), Clear, Markers panel toggle. **Basemap switch (bottom-right):** Map / Satellite.

---

## 17. Visual & Brand

- **Logo** (`components/logo.tsx`): heraldic shield enclosing an upward navigation spearhead (`LogoMark` SVG + optional "Sentry" wordmark). Shield `currentColor`, arrow `#ef4444`.
- **Typography:** Inter (`--font-sans`), JetBrains Mono (`--font-mono`).
- **Iconography:** lucide line icons throughout (no emoji) — consistent across map badges, popups, sidebar legend, and inspector.

---

## 18. Non-Goals & Limitations (must be surfaced in-product)

- Not an official warning system; decision support only — field verification required for emergency decisions.
- Building-state markers are deterministic proxies from hazard exposure + footprint size, **not** verified damage assessments.
- Satellite/FIRMS data lags real time; OSM coverage is incomplete in many regions; earthquake monitoring is **not** predictive.
- `/settings` must show data-feed health and a limitations disclosure **without** exposing backend infrastructure details (DB mode, env, ingest internals).

---

## 19. Reconstruction Acceptance Checklist

1. Auth-gated app; Supabase session; `dos_workspace`/`dos_project` cookies; auto-provision workspace on first use.
2. Postgres via Prisma with the schema in §5; `getRepo()` throws without `DATABASE_URL`.
3. Background ingest worker upserts USGS/GDACS(+FIRMS) into `HazardEventRecord` every 5 min; `/api/hazards` polled at 60s.
4. `analyzeRegion` produces risk scores (per §9 weights), sector grid (8 km), clipped exposure, sources, areaKm2.
5. `Analyze` → deterministic brief (no key); `Deep Analyze` → LLM brief (OpenAI/OpenRouter) + building-marker preview.
6. Region draw auto-saves to `/api/zones`; shape edits auto-PATCH; all major actions logged to the in-memory feed shown in the bottom panel.
7. Map renders lucide pin badges for hazards (severity-sized, color-ringed) and state-colored category markers; popups use matching icons.
8. Light/dark theme toggle with no-flash init; basemap Map/Satellite toggle (CARTO + Esri rasters); both independent.
9. Layer tabs support create, focus, visibility toggle, and edit (rename/recolor/delete); artifact lists respect layer visibility + focus.
10. Trigger builder + `/api/triggers/evaluate` (metrics map per §11) → severity-ranked `AlertRecord`s shown in `/alerts`, acknowledgable, optional LLM brief.
11. Pages: `/w/:workspace`, `/zones`, `/alerts`, `/projects`, `/settings`; bare auth/onboarding routes.

---

_Companion document: `PRODUCT.md` (narrative product description). This PRD is the technical reconstruction reference._
