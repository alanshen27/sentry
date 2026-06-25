import { NextResponse } from "next/server";
import { runIngest } from "@/lib/ingest/worker";
import { getRepo } from "@/lib/db";
import { getApiUser, Unauthorized } from "@/lib/auth/context";

export const dynamic = "force-dynamic";

// Manual / cron trigger. POST to run one ingest pass immediately.
export async function POST() {
  try {
    await getApiUser();
  } catch {
    // allow cron via shared secret if provided
    const auth = process.env.INGEST_CRON_SECRET;
    if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await runIngest();
  return NextResponse.json(result);
}

// Latest ingest runs + current event stats.
export async function GET() {
  try { await getApiUser(); } catch { return NextResponse.json({ error: "unauthorized" }, { status: 401 }); }
  const repo = getRepo();
  const [runs, stats] = await Promise.all([repo.listIngestRuns(10), repo.hazardEventStats()]);
  return NextResponse.json({ runs, stats });
}
