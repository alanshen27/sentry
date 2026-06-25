import { analyzeRegion } from "../lib/risk";
import { getLlmConfig } from "../lib/llm/provider";
import { generateBrief } from "../lib/llm/generateBrief";
import { getDemoRegion } from "../lib/demo-regions";

async function main() {
  const region = getDemoRegion("kenya_somalia_border")!;
  console.log("== Region:", region.name);

  if (!process.env.REDIS_URL) {
    console.log("\n⚠ REDIS_URL not set — skipping runtime smoke (Redis is required, no fallback).");
    console.log("✅ Build/typecheck remain the verification gate. Set REDIS_URL + an LLM key to run this.");
    return;
  }

  console.log("\n[1/3] Running analyzeRegion…");
  const t0 = Date.now();
  const r = await analyzeRegion({ geometry: region.polygon, hazards: region.hazards, cellSizeKm: 8 });
  console.log(`  done in ${Date.now() - t0}ms | areaKm2: ${r.areaKm2}`);
  console.log("  overallRisk:", r.overallRisk, "| confidence:", r.overallConfidence, "| sectors:", r.sectors.length);
  console.log("  exposed -> buildings:", r.exposedAssets.buildings, "| roads:", r.exposedAssets.roadLengthKm, "km | schools:", r.exposedAssets.schools, "| hospitals:", r.exposedAssets.hospitals);
  for (const s of r.riskScores) console.log(`    - ${s.hazard}: ${s.score}/100 (${s.level}) conf ${s.confidence}`);

  if (!getLlmConfig()) {
    console.log("\n[2/3] Skipped — no LLM key set (required for brief generation).");
  } else {
    console.log("\n[2/3] Generating LLM brief…");
    const brief = await generateBrief({
      zoneName: region.name, areaKm2: r.areaKm2, riskScores: r.riskScores,
      overallRisk: r.overallRisk, overallConfidence: r.overallConfidence,
      sectors: r.sectors, exposedAssets: r.exposedAssets, events: r.events.slice(0, 20),
      triggers: [], dataGaps: [],
    });
    console.log("  provider:", brief.provider, "| sections:", brief.sections.length, "| alerts:", brief.suggestedAlerts.length);
    console.log("  " + brief.sections[0]?.body);
  }

  console.log("\n[3/3] House-eval markers (all footprints)…");
  const { evaluateBuildings } = await import("../lib/llm/houseEval");
  const evals = evaluateBuildings(r.osm.buildings, r.riskScores, r.riskScores[0]?.hazard ?? "wildfire");
  console.log("  footprints -> markers:", evals.length);
  console.log("\n✅ Pipeline OK");
}

main().catch((e) => { console.error("FAIL:", e); process.exit(1); });
