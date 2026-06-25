import { NextResponse } from "next/server";
import { getRepo } from "@/lib/db";
import { getApiUser, ensureWorkspaceId, getActiveProjectId, Unauthorized } from "@/lib/auth/context";
import type { HazardType } from "@/lib/types";

export async function GET(req: Request) {
  try {
    await getApiUser();
    const wsId = await ensureWorkspaceId();
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId") ?? getActiveProjectId() ?? undefined;
    const layerId = searchParams.get("layerId") ?? undefined;
    const zones = await getRepo().listZones(wsId, projectId, layerId);
    return NextResponse.json({ zones });
  } catch (e) { return handle(e); }
}

export async function POST(req: Request) {
  try {
    const user = await getApiUser();
    const wsId = await ensureWorkspaceId();
    const body = await req.json();
    const zone = await getRepo().createZone({
      workspaceId: wsId, projectId: body.projectId ?? getActiveProjectId() ?? null,
      layerId: body.layerId ?? null,
      ownerId: user.id, name: body.name, geometry: body.geometry,
      hazards: (body.hazards ?? []) as HazardType[], notes: body.notes,
    });
    return NextResponse.json({ zone });
  } catch (e) { return handle(e); }
}

function handle(e: unknown) {
  if (e instanceof Unauthorized) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ error: String(e) }, { status: 500 });
}
