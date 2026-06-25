import { NextResponse } from "next/server";
import { getRepo } from "@/lib/db";
import { getApiUser, ensureWorkspaceId, Unauthorized } from "@/lib/auth/context";

export async function GET() {
  try {
    await getApiUser();
    const wsId = await ensureWorkspaceId();
    const alerts = await getRepo().listAlerts(wsId);
    return NextResponse.json({ alerts });
  } catch (e) { return handle(e); }
}

function handle(e: unknown) {
  if (e instanceof Unauthorized) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ error: String(e) }, { status: 500 });
}
