import { NextResponse } from "next/server";
import { getRepo } from "@/lib/db";
import { getApiUser, ensureWorkspaceId, Unauthorized } from "@/lib/auth/context";
import { analyzeRegion } from "@/lib/risk";
import { generateBrief, type BriefInput } from "@/lib/llm/generateBrief";
import { riskLevelFromScore, type RiskLevel } from "@/lib/types";

interface Body { zoneId?: string; }

export async function POST(req: Request) {
  try {
    await getApiUser();
    const wsId = await ensureWorkspaceId();
    const body = (await req.json().catch(() => ({}))) as Body;
    const repo = getRepo();

    const triggers = await repo.listTriggers(wsId, body.zoneId);
    const activeTriggers = triggers.filter((t) => t.enabled && t.zoneId);
    const zoneIds = [...new Set(activeTriggers.map((t) => t.zoneId!))];

    const firedAlerts: any[] = [];
    for (const zoneId of zoneIds) {
      const zone = await repo.getZone(zoneId);
      if (!zone) continue;
      let metrics: Record<string, number>;
      let snapshot: any;
      try {
        const r = await analyzeRegion({ geometry: zone.geometry, hazards: zone.hazards as any, cellSizeKm: 12 });
        metrics = computeMetrics(r, zone.hazards as any[]);
        snapshot = r;
      } catch {
        continue;
      }

      for (const t of activeTriggers.filter((x) => x.zoneId === zoneId)) {
        const val = metrics[t.metric];
        if (val === undefined) continue;
        const hit = evaluate(t.operator, val, t.threshold);
        const cooled = !t.lastFired || Date.now() - new Date(t.lastFired).getTime() > t.cooldownMinutes * 60000;
        if (hit && cooled) {
          let brief: any = undefined;
          if (t.actions.some((a: any) => a.type === "llm_brief")) {
            const bi: BriefInput = {
              zoneName: zone.name, areaKm2: snapshot.areaKm2, riskScores: snapshot.riskScores,
              overallRisk: snapshot.overallRisk, overallConfidence: snapshot.overallConfidence,
              sectors: snapshot.sectors, exposedAssets: snapshot.exposedAssets, events: snapshot.events.slice(0, 20),
              triggers: [{ name: t.name, naturalLanguage: t.naturalLanguage }], dataGaps: [],
            };
            brief = await generateBrief(bi);
          }
          const severity: RiskLevel = snapshot.overallRisk >= 76 ? "Severe" : snapshot.overallRisk >= 51 ? "High" : snapshot.overallRisk >= 26 ? "Moderate" : "Low";
          const alert = await repo.createAlert({
            workspaceId: wsId, triggerId: t.id, zoneId, userId: null,
            triggerName: t.name, zoneName: zone.name, hazard: t.hazard,
            message: `${t.naturalLanguage} (current ${t.metric}=${val.toFixed ? val.toFixed(1) : val})`,
            severity, brief, actions: t.actions,
          });
          await repo.updateTrigger(t.id, { lastFired: new Date().toISOString() });
          fireActions(t.actions, alert.message);
          firedAlerts.push(alert);
        }
      }
    }
    return NextResponse.json({ fired: firedAlerts, count: firedAlerts.length, evaluated: activeTriggers.length });
  } catch (e) { return handle(e); }
}

function computeMetrics(r: any, _hazards: string[]): Record<string, number> {
  const m: Record<string, number> = {};
  m.risk_score = r.overallRisk;
  m.confidence = r.overallConfidence;
  m.exposed_buildings = r.exposedAssets.buildings;
  m.event_count = r.events.length;
  m.severity = r.events.reduce((s: number, e: any) => Math.max(s, e.severity), 0);
  m.active_fire_count = r.events.filter((e: any) => e.type === "wildfire").length;
  const quake = r.events.find((e: any) => e.type === "earthquake");
  m.earthquake_magnitude = quake?.properties?.magnitude ?? 0;
  if (r.weather) {
    m.wind_speed = r.weather.windSpeedKmh;
    m.rainfall_24h = r.weather.precipitationMm + r.weather.forecastHours.slice(0, 24).reduce((s: number, h: any) => s + h.precipMm, 0);
  }
  if (r.riskScores) {
    const dr = r.riskScores.find((x: any) => x.hazard === "drought");
    if (dr) m.drought_anomaly = dr.score;
  }
  m.gdacs_alert_level = r.events.filter((e: any) => e.source === "GDACS").length;
  m.trend_change = 0;
  return m;
}

function evaluate(op: string, val: number, threshold: number): boolean {
  switch (op) {
    case ">": return val > threshold;
    case ">=": return val >= threshold;
    case "<": return val < threshold;
    case "<=": return val <= threshold;
    case "==": return val === threshold;
    case "change_gt": return val > threshold;
    default: return false;
  }
}

function fireActions(actions: any[], message: string) {
  for (const a of actions) {
    switch (a.type) {
      case "email": console.log(`[mock email -> ${a.target ?? "ops@"}] ${message}`); break;
      case "sms": console.log(`[mock sms -> ${a.target ?? "+000"}] ${message}`); break;
      case "webhook": console.log(`[mock webhook -> ${a.target ?? "/hook"}] ${message}`); break;
      case "dashboard_alert": case "llm_brief": case "incident_task": break;
    }
  }
}

function handle(e: unknown) {
  if (e instanceof Unauthorized) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ error: String(e) }, { status: 500 });
}
