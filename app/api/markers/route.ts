import { NextResponse } from "next/server";
import { getRepo } from "@/lib/db";
import { getApiUser, ensureWorkspaceId, getActiveProjectId, Unauthorized } from "@/lib/auth/context";

export async function GET(req: Request) {
  try {
    await getApiUser();
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId") ?? getActiveProjectId();
    if (!projectId) return NextResponse.json({ markers: [] });
    const markers = await getRepo().listMarkers(projectId, {
      layerId: searchParams.get("layerId") ?? undefined,
      state: searchParams.get("state") ?? undefined,
      category: searchParams.get("category") ?? undefined,
      source: searchParams.get("source") ?? undefined,
    });
    return NextResponse.json({ markers });
  } catch (e) { return handle(e); }
}

export async function POST(req: Request) {
  try {
    const user = await getApiUser();
    const wsId = await ensureWorkspaceId();
    const body = await req.json();
    const projectId = body.projectId ?? getActiveProjectId();
    if (!projectId) return NextResponse.json({ error: "active project required" }, { status: 400 });
    const byName = user.name?.trim() || user.email.split("@")[0];
    const now = new Date().toISOString();
    const bulk = Array.isArray(body.markers) ? body.markers : [body];
    const inputs = bulk.map((m: any) => {
      const state = m.state ?? "pending";
      return {
        projectId, layerId: m.layerId ?? body.layerId ?? null, workspaceId: wsId,
        geometry: m.geometry, label: m.label ?? null, color: m.color ?? "#f97316",
        state, category: m.category ?? "observation",
        sizeM2: m.sizeM2 ?? null, confidence: m.confidence ?? null, source: m.source ?? "user",
        notes: m.notes ?? null, createdBy: user.id,
        statusHistory: [{ from: null, state, byId: user.id, byName, at: now }],
      };
    });
    const created = await getRepo().bulkCreateMarkers(inputs);
    return NextResponse.json({ markers: created, count: created.length });
  } catch (e) { return handle(e); }
}

function handle(e: unknown) {
  if (e instanceof Unauthorized) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ error: String(e) }, { status: 500 });
}
