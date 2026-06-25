import type { RiskScore, Sector, ExposedAssets, HazardEvent } from "@/lib/types";
import { HAZARD_LABELS, riskLevelFromScore } from "@/lib/types";

export interface BriefInput {
  zoneName: string;
  areaKm2: number;
  riskScores: RiskScore[];
  overallRisk: number;
  overallConfidence: number;
  sectors: Sector[];
  exposedAssets: ExposedAssets;
  events: HazardEvent[];
  triggers: { name: string; naturalLanguage: string }[];
  dataGaps: string[];
}

export function buildBriefPrompt(input: BriefInput): { system: string; user: string } {
  const system = `You are Sentry, an operations intelligence assistant for disaster coordinators. You receive ONLY structured data and produce a concise operational brief. RULES:
- Never invent facts. Never claim exact casualties or house occupancy.
- Never say earthquakes are predicted. They are monitored after detection only.
- Phrase recommendations as decision support, NOT official emergency orders.
- When confidence is Medium/Low, include "verify with local authorities/field teams".
- Output exactly these 11 sections, each as "## <Heading>\\n<body>": Executive Summary, Current Risk Level, What Changed, Most Exposed Sectors, Potentially Affected Buildings, Critical Infrastructure At Risk, Recommended Actions, Suggested Alerts/Messages, Field Verification Tasks, Uncertainty & Confidence Limitations, Next Update Plan.
- Keep each section to 1-3 sentences. Be specific using the data provided.`;

  const user = `WATCH ZONE: ${input.zoneName} (${input.areaKm2} km²)
OVERALL RISK: ${input.overallRisk}/100 (${riskLevelFromScore(input.overallRisk)}), confidence ${(input.overallConfidence * 100).toFixed(0)}%

HAZARD SCORES:
${input.riskScores.map((r) => `- ${HAZARD_LABELS[r.hazard]}: ${r.score}/100 (${r.level}), confidence ${(r.confidence * 100).toFixed(0)}% — drivers: ${r.drivers.join("; ")}`).join("\n")}

SECTORS (top 5 by risk):
${[...input.sectors].sort((a, b) => b.overallRisk - a.overallRisk).slice(0, 5).map((s) => `- ${s.id}: risk ${s.overallRisk}, ${s.exposedBuildings} buildings, ${s.roadLengthKm}km roads, ${s.criticalAssets} critical assets, ~${s.populationEstimate} pop`).join("\n")}

EXPOSED ASSETS:
- Buildings: ${input.exposedAssets.buildings}
- Roads: ${input.exposedAssets.roadLengthKm} km
- Schools: ${input.exposedAssets.schools}, Hospitals: ${input.exposedAssets.hospitals}, Clinics: ${input.exposedAssets.clinics}, Shelters: ${input.exposedAssets.shelters}
- Estimated population exposed: ${input.exposedAssets.populationEstimate}
- Critical facilities: ${input.exposedAssets.criticalFacilities.map((f) => f.name + "(" + f.type + ")").join(", ") || "none mapped"}

RECENT EVENTS (in/near zone): ${input.events.length} total. Top: ${input.events.slice(0, 8).map((e) => `${e.type}(${e.source}, sev ${e.severity})`).join(", ")}

ACTIVE TRIGGERS: ${input.triggers.length ? input.triggers.map((t) => t.naturalLanguage).join(" | ") : "none"}

DATA GAPS: ${input.dataGaps.join("; ") || "none noted"}

Produce the 11-section operational brief now. After the sections, on a final line starting "ALERTS:", provide 1-3 short SMS-style alert messages (max 140 chars each), pipe-separated.`;

  return { system, user };
}
