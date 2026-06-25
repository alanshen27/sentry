import { NextResponse } from "next/server";
import { getRepo } from "@/lib/db";
import { getApiUser, ensureWorkspaceId, getActiveWorkspaceId, Unauthorized } from "@/lib/auth/context";

export async function GET(req: Request) {
  try {
    const user = await getApiUser();
    const repo = getRepo();
    await repo.upsertUser({ id: user.id, email: user.email, name: user.name });
    const wsId = getActiveWorkspaceId();
    if (!wsId) return NextResponse.json({ projects: [] });
    const memberships = await repo.listWorkspaces(user.id);
    if (!memberships.some((w) => w.id === wsId)) return NextResponse.json({ projects: [] });
    const projects = await repo.listProjects(wsId);
    return NextResponse.json({ projects });
  } catch (e) { return handle(e); }
}

export async function POST(req: Request) {
  try {
    const user = await getApiUser();
    const wsId = await ensureWorkspaceId();
    const body = await req.json();
    const repo = getRepo();
    const project = await repo.createProject({
      workspaceId: wsId, ownerId: user.id, name: body.name,
      description: body.description, defaultLat: body.defaultLat, defaultLng: body.defaultLng, defaultZoom: body.defaultZoom,
    });
    return NextResponse.json({ project });
  } catch (e) { return handle(e); }
}

function handle(e: unknown) {
  if (e instanceof Unauthorized) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ error: String(e) }, { status: 500 });
}
