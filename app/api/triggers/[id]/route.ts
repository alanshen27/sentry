import { NextResponse } from "next/server";
import { getRepo } from "@/lib/db";
import { getApiUser, Unauthorized } from "@/lib/auth/context";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    await getApiUser();
    const patch = await req.json();
    const t = await getRepo().updateTrigger(params.id, patch);
    return NextResponse.json({ trigger: t });
  } catch (e) { return handle(e); }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await getApiUser();
    await getRepo().deleteTrigger(params.id);
    return NextResponse.json({ ok: true });
  } catch (e) { return handle(e); }
}

function handle(e: unknown) {
  if (e instanceof Unauthorized) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ error: String(e) }, { status: 500 });
}
