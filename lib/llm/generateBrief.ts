import type { BriefResult } from "@/lib/types";
import { HAZARD_LABELS, riskLevelFromScore } from "@/lib/types";
import { llmComplete, getLlmConfig } from "./provider";
import { buildBriefPrompt, type BriefInput } from "./prompt";

/** Rule-based summary from risk engine output — no API key required. */
export function buildDeterministicBrief(input: BriefInput): BriefResult {
  const level = riskLevelFromScore(input.overallRisk);
  const topHazards = [...input.riskScores].sort((a, b) => b.score - a.score).slice(0, 3);
  const topSectors = [...input.sectors].sort((a, b) => b.overallRisk - a.overallRisk).slice(0, 3);
  const topEvents = input.events.slice(0, 5);

  const sections = [
    {
      heading: "Executive Summary",
      body: `${input.zoneName} (${input.areaKm2} km²) — overall risk ${input.overallRisk}/100 (${level}), confidence ${Math.round(input.overallConfidence * 100)}%. Primary drivers: ${topHazards.map((h) => `${HAZARD_LABELS[h.hazard]} (${h.score})`).join(", ") || "none scored"}.`,
    },
    {
      heading: "Current Risk Level",
      body: topHazards.map((h) => `${HAZARD_LABELS[h.hazard]}: ${h.score}/100 (${h.level}) — ${h.drivers.slice(0, 2).join("; ") || "no drivers"}`).join("\n") || "No hazard scores computed.",
    },
    {
      heading: "Most Exposed Sectors",
      body: topSectors.length
        ? topSectors.map((s) => `${s.id}: risk ${s.overallRisk}, ${s.exposedBuildings} buildings, ${s.roadLengthKm.toFixed(1)} km roads`).join("\n")
        : "No sectors segmented.",
    },
    {
      heading: "Exposed Assets",
      body: `${input.exposedAssets.buildings} buildings, ${input.exposedAssets.roadLengthKm.toFixed(1)} km roads, ${input.exposedAssets.schools} schools, ${input.exposedAssets.hospitals} hospitals. Est. population exposed: ~${input.exposedAssets.populationEstimate}.`,
    },
    {
      heading: "Active Events in Region",
      body: topEvents.length
        ? topEvents.map((e) => `${e.type} (${e.source}) severity ${e.severity}/100`).join("\n")
        : "No hazard events intersect this region.",
    },
    {
      heading: "Data Gaps",
      body: input.dataGaps.length ? input.dataGaps.join("\n") : "All primary sources connected.",
    },
    {
      heading: "Next Steps",
      body: "Run Deep Analyze for an AI-written operational brief and per-building markers. Verify high-risk sectors with field teams.",
    },
  ];

  const text = sections.map((s) => `## ${s.heading}\n${s.body}`).join("\n\n");

  return {
    text,
    sections,
    generatedAt: new Date().toISOString(),
    model: "deterministic",
    provider: "computed",
    suggestedAlerts: topHazards.filter((h) => h.score >= 60).slice(0, 2).map(
      (h) => `Monitor ${HAZARD_LABELS[h.hazard]} — score ${h.score}/100 in ${input.zoneName}`,
    ),
  };
}

export async function generateBrief(input: BriefInput): Promise<BriefResult> {
  const cfg = getLlmConfig();
  if (!cfg) {
    throw new Error(
      "An LLM API key is required (OPENAI_API_KEY or OPENROUTER_API_KEY). No mock fallback in production."
    );
  }

  const { system, user } = buildBriefPrompt(input);
  const text = await llmComplete(system, user, { maxTokens: 1400 });
  const sections = parseSections(text);
  const alertsLine = text.split("\n").find((l) => l.startsWith("ALERTS:"));
  const suggestedAlerts = alertsLine
    ? alertsLine.replace("ALERTS:", "").split("|").map((s) => s.trim()).filter(Boolean).slice(0, 3)
    : [];

  return {
    text: text.replace(/ALERTS:.*$/s, "").trim(),
    sections,
    generatedAt: new Date().toISOString(),
    model: cfg.model,
    provider: cfg.provider,
    suggestedAlerts,
  };
}

function parseSections(text: string): { heading: string; body: string }[] {
  const parts = text.split(/^##\s+/m).map((p) => p.trim()).filter(Boolean);
  return parts.map((p) => {
    const nl = p.indexOf("\n");
    if (nl < 0) return { heading: p, body: "" };
    return { heading: p.slice(0, nl).trim(), body: p.slice(nl + 1).trim() };
  });
}

export { buildBriefPrompt } from "./prompt";
export type { BriefInput } from "./prompt";
