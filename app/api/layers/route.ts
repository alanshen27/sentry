import { NextResponse } from "next/server";
import { getRepo } from "@/lib/db";
import { getApiUser, Unauthorized } from "@/lib/auth/context";
import { autoLayerColor } from "@/lib/layers/colors";

export async function GET(req: Request) {
  try {
    await getApiUser();
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });
    const layers = await getRepo().listLayers(projectId);
    return NextResponse.json({ layers });
  } catch (e) { return handle(e); }
}

export async function POST(req: Request) {
  try {
    await getApiUser();
    const body = await req.json();
    const existing = await getRepo().listLayers(body.projectId);
    const layer = await getRepo().createLayer({
      projectId: body.projectId,
      name: body.name,
      type: body.type ?? "overlay",
      color: body.color ?? autoLayerColor(body.name ?? "layer", existing.length),
      description: body.description,
    });
    return NextResponse.json({ layer });
  } catch (e) { return handle(e); }
}

function handle(e: unknown) {
  if (e instanceof Unauthorized) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ error: String(e) }, { status: 500 });
}
