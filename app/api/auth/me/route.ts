import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/supabase";
import { getRepo } from "@/lib/db";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  // ensure user record exists in DB (for ownership/relations)
  try { await getRepo().upsertUser({ id: user.id, email: user.email, name: user.name }); } catch {}
  return NextResponse.json({ user });
}
