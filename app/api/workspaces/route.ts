import { NextResponse } from "next/server";
import { getRepo } from "@/lib/db";
import { getApiUser, getActiveWorkspaceId, Unauthorized } from "@/lib/auth/context";

export async function GET() {
  try {
    const user = await getApiUser();
    const repo = getRepo();
    await repo.upsertUser({ id: user.id, email: user.email, name: user.name });
    const list = await repo.listWorkspaces(user.id);
    return NextResponse.json({ workspaces: list });
  } catch (e) {
    if (e instanceof Unauthorized) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    throw e;
  }
}

export async function POST(req: Request) {
  try {
    const user = await getApiUser();
    const { name } = await req.json();
    const repo = getRepo();
    await repo.upsertUser({ id: user.id, email: user.email, name: user.name });
    const ws = await repo.createWorkspace(name || "New workspace", user.id);
    return NextResponse.json({ workspace: ws });
  } catch (e) {
    if (e instanceof Unauthorized) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
