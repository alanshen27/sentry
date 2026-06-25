import type { HouseEvalMarker } from "@/lib/llm/houseEval";

export interface PendingMarkerBreakdown {
  total: number;
  byState: Record<string, number>;
  byCategory: Record<string, number>;
  /** state → category → count (for exact filtered totals) */
  byStateCategory: Record<string, Record<string, number>>;
}

export function summarizeMarkerEvals(evals: HouseEvalMarker[]): PendingMarkerBreakdown {
  const byState: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const byStateCategory: Record<string, Record<string, number>> = {};

  for (const e of evals) {
    byState[e.state] = (byState[e.state] ?? 0) + 1;
    byCategory[e.category] = (byCategory[e.category] ?? 0) + 1;
    if (!byStateCategory[e.state]) byStateCategory[e.state] = {};
    byStateCategory[e.state][e.category] = (byStateCategory[e.state][e.category] ?? 0) + 1;
  }

  return { total: evals.length, byState, byCategory, byStateCategory };
}

export function countFilteredMarkers(
  breakdown: PendingMarkerBreakdown,
  states: string[],
  categories: string[],
): number {
  if (!states.length || !categories.length) return 0;
  const stateSet = new Set(states);
  const catSet = new Set(categories);
  let n = 0;
  for (const [state, cats] of Object.entries(breakdown.byStateCategory)) {
    if (!stateSet.has(state)) continue;
    for (const [cat, count] of Object.entries(cats)) {
      if (catSet.has(cat)) n += count;
    }
  }
  return n;
}

export function filterMarkerEvals(
  evals: HouseEvalMarker[],
  states?: string[],
  categories?: string[],
): HouseEvalMarker[] {
  if (!states?.length || !categories?.length) return [];
  const stateSet = new Set(states);
  const catSet = new Set(categories);
  return evals.filter((e) => stateSet.has(e.state) && catSet.has(e.category));
}
