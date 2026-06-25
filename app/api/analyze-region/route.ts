import { NextResponse } from "next/server";
import type { HazardType, WatchZone, AnalysisResult } from "@/lib/types";
import { analyzeRegion } from "@/lib/risk";
import { generateBrief, buildDeterministicBrief, type BriefInput } from "@/lib/llm/generateBrief";
import { evaluateBuildings } from "@/lib/llm/houseEval";
import { summarizeMarkerEvals } from "@/lib/markers/summary";
import { getRepo } from "@/lib/db";
import { getApiUser, ensureWorkspaceId, Unauthorized } from "@/lib/auth/context";
import { uid } from "@/lib/utils";

interface Body {
  geometry: GeoJSON.Polygon;
  hazards: HazardType[];
  deepAnalysis?: boolean;
  cellSizeKm?: number;
  zoneName?: string;
  zoneId?: string;
  projectId?: string;
  layerId?: string | null;
}

export async function POST(req: Request) {
  let user;
  try { user = await getApiUser(); } catch { return NextResponse.json({ error: "unauthorized" }, { status: 401 }); }
  const body = (await req.json()) as Body;

  const result = await analyzeRegion({
    geometry: body.geometry,
    hazards: body.hazards,
    deepAnalysis: body.deepAnalysis ?? false,
    cellSizeKm: body.cellSizeKm,
  });

  const repo = getRepo();
  const workspaceId = await ensureWorkspaceId();

  // resolve / synthesize watch zone
  let zone: WatchZone;
  if (body.zoneId) {
    const z = await repo.getZone(body.zoneId);
    zone = z ?? synthZone(body, workspaceId);
  } else {
    zone = synthZone(body, workspaceId);
  }

  const dataGaps = result.sources
    .filter((s) => s.state !== "connected")
    .map((s) => `${s.name} on ${s.state}`)
    .concat(result.exposedAssets.buildings === 0 ? ["OSM building coverage incomplete or empty"] : []);

  const briefInput: BriefInput = {
    zoneName: zone.name,
    areaKm2: result.areaKm2,
    riskScores: result.riskScores,
    overallRisk: result.overallRisk,
    overallConfidence: result.overallConfidence,
    sectors: result.sectors,
    exposedAssets: result.exposedAssets,
    events: result.events.slice(0, 30),
    triggers: zone.triggers ?? [],
    dataGaps,
  };
  const brief = body.deepAnalysis
    ? await generateBrief(briefInput)
    : buildDeterministicBrief(briefInput);

  const primaryHazard = [...result.riskScores].sort((a, b) => b.score - a.score)[0]?.hazard ?? "wildfire";

  // Building footprint markers — preview only; saved when user clicks Add to layer
  const evals = evaluateBuildings(result.osm.buildings, result.riskScores, primaryHazard, result.sectors);
  const pendingMarkerBreakdown = summarizeMarkerEvals(evals);
  const pendingMarkerCount = pendingMarkerBreakdown.total;

  const analysisResult: AnalysisResult = {
    zone,
    sectors: result.sectors,
    riskScores: result.riskScores,
    overallRisk: result.overallRisk,
    overallConfidence: result.overallConfidence,
    exposedAssets: result.exposedAssets,
    brief,
    sources: result.sources,
    updatedAt: result.updatedAt,
  };

  await repo.createSnapshot({ zoneId: body.zoneId, projectId: body.projectId, result: analysisResult as any });

  return NextResponse.json({
    ...analysisResult,
    areaKm2: result.areaKm2,
    weather: result.weather,
    events: result.events,
    osm: result.osm,
    pendingMarkerCount,
    pendingMarkerBreakdown,
    dbMode: (await import("@/lib/db")).dbMode(),
  });
}

function synthZone(body: Body, _wsId: string): WatchZone {
  return {
    id: body.zoneId ?? uid("zone"),
    name: body.zoneName ?? "Untitled Watch Zone",
    geometry: body.geometry,
    createdAt: new Date().toISOString(),
    hazards: body.hazards,
    triggers: [],
  };
}
