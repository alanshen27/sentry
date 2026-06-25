import { NextResponse } from "next/server";
import { getRepo } from "@/lib/db";
import { getApiUser, ensureWorkspaceId, Unauthorized } from "@/lib/auth/context";
import { uid } from "@/lib/utils";
import type { TriggerAction, HazardType } from "@/lib/types";

export async function GET(req: Request) {
  try {
    await getApiUser();
    const wsId = await ensureWorkspaceId();
    const { searchParams } = new URL(req.url);
    const zoneId = searchParams.get("zoneId") ?? undefined;
    const triggers = await getRepo().listTriggers(wsId, zoneId);
    return NextResponse.json({ triggers });
  } catch (e) { return handle(e); }
}

export async function POST(req: Request) {
  try {
    const user = await getApiUser();
    const wsId = await ensureWorkspaceId();
    const body = await req.json();
    const trigger = await getRepo().createTrigger({
      workspaceId: wsId, zoneId: body.zoneId ?? null, name: body.name ?? `Trigger ${uid("").slice(-4)}`,
      hazard: body.hazard as HazardType, metric: body.metric, operator: body.operator,
      threshold: Number(body.threshold), durationMinutes: Number(body.durationMinutes ?? 0),
      cooldownMinutes: Number(body.cooldownMinutes ?? 30), actions: (body.actions ?? [{ type: "dashboard_alert" }]) as TriggerAction[],
      naturalLanguage: body.naturalLanguage ?? describeRule(body), enabled: body.enabled ?? true,
    });
    return NextResponse.json({ trigger });
  } catch (e) { return handle(e); }
}

function handle(e: unknown) {
  if (e instanceof Unauthorized) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ error: String(e) }, { status: 500 });
}

function describeRule(b: any): string {
  const opWord: Record<string, string> = { ">": "above", ">=": "at or above", "<": "below", "<=": "at or below", "==": "equal to", change_gt: "increases by more than" };
  const dur = b.durationMinutes ? ` for ${b.durationMinutes} min` : "";
  return `Alert when ${b.hazard ?? "risk"} ${b.metric ?? "risk_score"} is ${opWord[b.operator] ?? "above"} ${b.threshold}${dur}.`;
}
