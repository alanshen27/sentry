import { NextResponse } from "next/server";
import { getRepo } from "@/lib/db";
import { getApiUser, Unauthorized } from "@/lib/auth/context";
import type { HazardType } from "@/lib/types";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    await getApiUser();
    const body = await req.json();
    const zone = await getRepo().updateZone(params.id, {
      name: body.name,
      geometry: body.geometry,
      hazards: body.hazards as HazardType[] | undefined,
      notes: body.notes,
      layerId: body.layerId,
    });
    return NextResponse.json({ zone });
  } catch (e) { return handle(e); }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await getApiUser();
    await getRepo().deleteZone(params.id);
    return NextResponse.json({ ok: true });
  } catch (e) { return handle(e); }
}

function handle(e: unknown) {
  if (e instanceof Unauthorized) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ error: String(e) }, { status: 500 });
}
