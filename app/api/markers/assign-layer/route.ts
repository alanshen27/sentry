import { NextResponse } from "next/server";
import { getRepo } from "@/lib/db";
import { getApiUser, Unauthorized } from "@/lib/auth/context";

export async function POST(req: Request) {
  try {
    await getApiUser();
    const body = await req.json();
    const markerIds = body.markerIds as string[] | undefined;
    if (!Array.isArray(markerIds) || markerIds.length === 0) {
      return NextResponse.json({ error: "markerIds required" }, { status: 400 });
    }
    const layerId = body.layerId ?? null;
    const count = await getRepo().bulkAssignMarkersToLayer(markerIds, layerId);
    return NextResponse.json({ ok: true, count, layerId });
  } catch (e) { return handle(e); }
}

function handle(e: unknown) {
  if (e instanceof Unauthorized) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ error: String(e) }, { status: 500 });
}
