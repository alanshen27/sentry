import { NextResponse } from "next/server";
import { getRepo } from "@/lib/db";
import { getApiUser, ensureWorkspaceId, getActiveProjectId, Unauthorized } from "@/lib/auth/context";

export async function GET(req: Request) {
  try {
    await getApiUser();
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId") ?? getActiveProjectId();
    const layerId = searchParams.get("layerId") ?? undefined;
    if (!projectId) return NextResponse.json({ segments: [] });
    const segments = await getRepo().listSegments(projectId, layerId ?? undefined);
    return NextResponse.json({ segments });
  } catch (e) { return handle(e); }
}

export async function POST(req: Request) {
  try {
    const user = await getApiUser();
    const wsId = await ensureWorkspaceId();
    const body = await req.json();
    const projectId = body.projectId ?? getActiveProjectId();
    if (!projectId) return NextResponse.json({ error: "active project required" }, { status: 400 });
    const segment = await getRepo().createSegment({
      projectId, layerId: body.layerId ?? null, workspaceId: wsId,
      geometry: body.geometry, label: body.label ?? null, color: body.color ?? "#38bdf8",
      state: body.state ?? "active", riskScore: body.riskScore ?? null, notes: body.notes ?? null,
      createdBy: user.id,
    });
    return NextResponse.json({ segment });
  } catch (e) { return handle(e); }
}

function handle(e: unknown) {
  if (e instanceof Unauthorized) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ error: String(e) }, { status: 500 });
}
