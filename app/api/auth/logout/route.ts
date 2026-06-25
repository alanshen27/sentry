import { NextResponse } from "next/server";
import { createServer } from "@/lib/auth/supabase";

export async function POST() {
  const supabase = await createServer();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  const supabase = await createServer();
  await supabase.auth.signOut();
  const url = new URL("/login", req.url);
  return NextResponse.redirect(url);
}
