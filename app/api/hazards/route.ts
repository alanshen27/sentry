import { NextResponse } from "next/server";
import { getRepo } from "@/lib/db";
import { runIngest } from "@/lib/ingest/worker";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const bboxParam = searchParams.get("bbox");
  const bbox = bboxParam ? bboxParam.split(",").map(Number) : undefined;
  const typesParam = searchParams.get("types");
  const types = typesParam ? typesParam.split(",") : undefined;
  const sinceHours = Number(searchParams.get("sinceHours") ?? "72");

  const repo = getRepo();
  let events = await repo.listHazardEvents({ bbox, types, sinceHours, limit: 2000 });

  // First run: DB empty -> ingest once, then read back.
  if (events.length === 0) {
    try { await runIngest(); } catch {}
    events = await repo.listHazardEvents({ bbox, types, sinceHours, limit: 2000 });
  }

  return NextResponse.json({
    events,
    count: events.length,
    source: "database",
    updatedAt: new Date().toISOString(),
  });
}
