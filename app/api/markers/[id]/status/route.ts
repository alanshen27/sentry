import { NextResponse } from "next/server";
import { getRepo } from "@/lib/db";
import { getApiUser, Unauthorized } from "@/lib/auth/context";
import { MARKER_STATES, MARKER_STATE_COLORS } from "@/lib/markers/constants";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getApiUser();
    const { state } = await req.json();
    if (!state || !MARKER_STATES.includes(state)) {
      return NextResponse.json({ error: "invalid state" }, { status: 400 });
    }
    const byName = user.name?.trim() || user.email.split("@")[0];
    const marker = await getRepo().setMarkerStatus(params.id, {
      state,
      color: MARKER_STATE_COLORS[state],
      by: { id: user.id, name: byName },
    });
    return NextResponse.json({ marker });
  } catch (e) {
    return handle(e);
  }
}

function handle(e: unknown) {
  if (e instanceof Unauthorized) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ error: String(e) }, { status: 500 });
}
