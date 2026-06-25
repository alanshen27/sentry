import { NextResponse } from "next/server";
import { getRepo } from "@/lib/db";
import { getApiUser, Unauthorized } from "@/lib/auth/context";

export async function PATCH(_req: Request, { params }: { params: { id: string } }) {
  try {
    await getApiUser();
    await getRepo().acknowledgeAlert(params.id);
    return NextResponse.json({ ok: true });
  } catch (e) { return handle(e); }
}

function handle(e: unknown) {
  if (e instanceof Unauthorized) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ error: String(e) }, { status: 500 });
}
