import { cookies } from "next/headers";
import { getSessionUser, type SessionUser } from "./supabase";

export async function getApiUser(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) throw new Unauthorized();
  return u;
}

export class Unauthorized extends Error {
  status = 401;
}

export function getActiveWorkspaceId(): string | null {
  return cookies().get("dos_workspace")?.value ?? null;
}
export function getActiveProjectId(): string | null {
  return cookies().get("dos_project")?.value ?? null;
}

export async function ensureWorkspaceId(explicit?: string | null): Promise<string> {
  const user = await getApiUser();
  const repo = (await import("@/lib/db")).getRepo();
  // Supabase auth ids must exist in our User table before workspace FK inserts.
  await repo.upsertUser({ id: user.id, email: user.email, name: user.name });

  let wsId = explicit ?? getActiveWorkspaceId();
  const memberships = await repo.listWorkspaces(user.id);
  if (wsId && memberships.some((w) => w.id === wsId)) return wsId;
  if (memberships.length) return memberships[0].id;
  const ws = await repo.createWorkspace(`${user.email.split("@")[0]}'s workspace`, user.id);
  return ws.id;
}
