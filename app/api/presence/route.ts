import { NextResponse } from "next/server";
import { getApiUser, Unauthorized } from "@/lib/auth/context";
import { setPresence, removePresence, colorForUser, type Presence } from "@/lib/realtime/presence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await getApiUser();
    const body = await req.json();
    const projectId = body.projectId;
    const lng = Number(body.lng);
    const lat = Number(body.lat);
    if (!projectId || !Number.isFinite(lng) || !Number.isFinite(lat)) {
      return NextResponse.json({ error: "projectId, lng, lat required" }, { status: 400 });
    }
    const presence: Presence = {
      userId: user.id,
      name: user.name?.trim() || user.email.split("@")[0],
      color: colorForUser(user.id),
      lng,
      lat,
      accuracy: Number.isFinite(Number(body.accuracy)) ? Number(body.accuracy) : null,
      device: body.device === "desktop" ? "desktop" : "mobile",
      at: new Date().toISOString(),
    };
    await setPresence(projectId, presence);
    return NextResponse.json({ ok: true, presence });
  } catch (e) {
    return handle(e);
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getApiUser();
    const projectId = new URL(req.url).searchParams.get("projectId");
    if (projectId) await removePresence(projectId, user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handle(e);
  }
}

function handle(e: unknown) {
  if (e instanceof Unauthorized) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ error: String(e) }, { status: 500 });
}
