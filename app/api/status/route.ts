import { NextResponse } from "next/server";
import { getSourcesStatus } from "@/lib/sources";
import { dbMode } from "@/lib/db";
import { cacheMode } from "@/lib/cache";
import { getRepo } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const sources = await getSourcesStatus();
  let ingest: { total: number; bySource: Record<string, number>; mostRecent: string | null; lastRuns: any[] } | null = null;
  try {
    const repo = getRepo();
    const [stats, runs] = await Promise.all([repo.hazardEventStats(), repo.listIngestRuns(6)]);
    ingest = { ...stats, lastRuns: runs };
  } catch (e: any) {
    ingest = null;
  }
  return NextResponse.json({
    sources,
    db: dbMode(),
    cache: cacheMode(),
    ingest,
    updatedAt: new Date().toISOString(),
  });
}
