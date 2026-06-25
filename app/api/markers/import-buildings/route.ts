import { NextResponse } from "next/server";
import type { HazardType } from "@/lib/types";
import { analyzeRegion } from "@/lib/risk";
import { evaluateBuildings } from "@/lib/llm/houseEval";
import { filterMarkerEvals } from "@/lib/markers/summary";
import { getRepo } from "@/lib/db";
import { getApiUser, ensureWorkspaceId, Unauthorized } from "@/lib/auth/context";

interface Body {
  projectId: string;
  layerId?: string | null;
  geometry: GeoJSON.Polygon;
  hazards: HazardType[];
  states?: string[];
  categories?: string[];
}

export async function POST(req: Request) {
  try {
    const user = await getApiUser();
    const workspaceId = await ensureWorkspaceId();
    const body = (await req.json()) as Body;

    if (!body.projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });
    if (!body.geometry) return NextResponse.json({ error: "geometry required" }, { status: 400 });

    const result = await analyzeRegion({
      geometry: body.geometry,
      hazards: body.hazards ?? [],
      deepAnalysis: true,
    });

    const primaryHazard = [...result.riskScores].sort((a, b) => b.score - a.score)[0]?.hazard ?? "wildfire";
    const evals = evaluateBuildings(result.osm.buildings, result.riskScores, primaryHazard, result.sectors);
    const filtered = filterMarkerEvals(evals, body.states, body.categories);

    if (!filtered.length) {
      return NextResponse.json({ count: 0, markers: [] });
    }

    const byName = user.name?.trim() || user.email.split("@")[0];
    const now = new Date().toISOString();
    const inputs = filtered.map((e) => ({
      projectId: body.projectId,
      workspaceId,
      geometry: e.geometry,
      label: e.label,
      color: e.color,
      state: e.state,
      category: e.category,
      sizeM2: e.sizeM2,
      confidence: e.confidence,
      source: e.source,
      notes: e.notes,
      layerId: body.layerId ?? null,
      createdBy: user.id,
      statusHistory: [{ from: null, state: e.state, byId: user.id, byName, at: now }],
    }));

    const created = await getRepo().bulkCreateMarkers(inputs);
    return NextResponse.json({ count: created.length, markers: created });
  } catch (e) { return handle(e); }
}

function handle(e: unknown) {
  if (e instanceof Unauthorized) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ error: String(e) }, { status: 500 });
}
