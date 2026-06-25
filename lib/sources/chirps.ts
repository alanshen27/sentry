import type { DroughtCell, SourceStatus } from "@/lib/types";
import { loadDemo } from "./demo";

export async function getDroughtCells(): Promise<{ cells: DroughtCell[]; status: SourceStatus }> {
  const cells = await loadDemo<DroughtCell[]>("chirps_drought_cells.json");
  return { cells, status: { id: "chirps", name: "CHIRPS Drought", state: "cached_fallback", lastUpdated: new Date().toISOString() } };
}
