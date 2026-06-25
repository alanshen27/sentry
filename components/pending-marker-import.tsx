"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  MARKER_STATE_COLORS,
  MARKER_STATE_LABELS,
  markerCategoryLabel,
  type MarkerState,
} from "@/lib/markers/constants";
import { countFilteredMarkers, type PendingMarkerBreakdown } from "@/lib/markers/summary";

interface Props {
  breakdown: PendingMarkerBreakdown;
  selectedStates: string[];
  selectedCategories: string[];
  onStatesChange: (states: string[]) => void;
  onCategoriesChange: (categories: string[]) => void;
  assignLayerId: string;
  onLayerChange: (id: string) => void;
  projectLayers: { id: string; name: string }[];
  activeProjectId: string | null;
  importing: boolean;
  onImport: () => void;
  /** filters only | actions only | full panel */
  mode?: "full" | "filters" | "actions";
}

function FilterChip({
  active,
  count,
  label,
  color,
  onClick,
}: {
  active: boolean;
  count: number;
  label: string;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] transition-colors",
        active
          ? "border-primary/50 bg-primary/10 text-foreground"
          : "border-border bg-background/40 text-muted-foreground line-through opacity-60",
      )}
    >
      {color && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />}
      <span>{label}</span>
      <span className="tabular-nums text-muted-foreground">({count.toLocaleString()})</span>
    </button>
  );
}

export function PendingMarkerImport({
  breakdown,
  selectedStates,
  selectedCategories,
  onStatesChange,
  onCategoriesChange,
  assignLayerId,
  onLayerChange,
  projectLayers,
  activeProjectId,
  importing,
  onImport,
  mode = "full",
}: Props) {
  const filteredCount = useMemo(
    () => countFilteredMarkers(breakdown, selectedStates, selectedCategories),
    [breakdown, selectedStates, selectedCategories],
  );

  const stateEntries = useMemo(
    () =>
      Object.entries(breakdown.byState).sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
      ),
    [breakdown.byState],
  );

  const categoryEntries = useMemo(
    () =>
      Object.entries(breakdown.byCategory).sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
      ),
    [breakdown.byCategory],
  );

  function toggleState(state: string) {
    const set = new Set(selectedStates);
    if (set.has(state)) set.delete(state);
    else set.add(state);
    onStatesChange([...set]);
  }

  function toggleCategory(category: string) {
    const set = new Set(selectedCategories);
    if (set.has(category)) set.delete(category);
    else set.add(category);
    onCategoriesChange([...set]);
  }

  function selectAllStates() {
    onStatesChange(Object.keys(breakdown.byState));
  }

  function selectAllCategories() {
    onCategoriesChange(Object.keys(breakdown.byCategory));
  }

  function selectHighRiskStates() {
    onStatesChange(["damaged", "destroyed", "pending", "unknown"].filter((s) => breakdown.byState[s]));
  }

  const actionsBlock = (
    <>
      <div className={cn("text-[10px] text-amber-200/90", mode !== "actions" && "mt-0")}>
        Selected: <strong>{filteredCount.toLocaleString()}</strong> of {breakdown.total.toLocaleString()}
      </div>
      {!activeProjectId ? (
        <p className="text-[10px] text-amber-200/80">Select a project in the top bar to add markers to a layer.</p>
      ) : projectLayers.length === 0 ? (
        <p className="text-[10px] text-amber-200/80">Create a layer in the top bar first.</p>
      ) : (
        <div className="flex items-center gap-1.5">
          <select
            value={assignLayerId}
            onChange={(e) => onLayerChange(e.target.value)}
            className="h-8 min-w-0 flex-1 rounded border border-border bg-background px-2 text-xs"
          >
            <option value="" disabled>Select layer…</option>
            {projectLayers.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <Button
            size="sm"
            variant="default"
            className="h-8 shrink-0 bg-amber-600 text-xs hover:bg-amber-600"
            disabled={importing || !assignLayerId || filteredCount === 0}
            onClick={onImport}
          >
            {importing ? "Adding…" : `Add ${filteredCount.toLocaleString()}`}
          </Button>
        </div>
      )}
    </>
  );

  if (mode === "actions") {
    return (
      <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 space-y-1.5">
        <div className="text-xs font-medium text-amber-100">
          {breakdown.total.toLocaleString()} building markers ready
        </div>
        {actionsBlock}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 space-y-2">
      <div>
        <div className="text-xs text-amber-100">
          {breakdown.total.toLocaleString()} building markers ready
        </div>
        <div className="text-[10px] text-muted-foreground">
          Filter by state & type, then add only the selection to a layer.
        </div>
      </div>

      {(mode === "full" || mode === "filters") && (
        <>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">State</span>
              <div className="flex gap-2 text-[10px]">
                <button type="button" className="text-primary hover:underline" onClick={selectAllStates}>All</button>
                <button type="button" className="text-primary hover:underline" onClick={selectHighRiskStates}>High risk</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {stateEntries.map(([state, count]) => (
                <FilterChip
                  key={state}
                  active={selectedStates.includes(state)}
                  count={count}
                  label={MARKER_STATE_LABELS[state as MarkerState] ?? state}
                  color={MARKER_STATE_COLORS[state as MarkerState]}
                  onClick={() => toggleState(state)}
                />
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Type</span>
              <button type="button" className="text-[10px] text-primary hover:underline" onClick={selectAllCategories}>All</button>
            </div>
            <div className="flex flex-wrap gap-1">
              {categoryEntries.map(([category, count]) => (
                <FilterChip
                  key={category}
                  active={selectedCategories.includes(category)}
                  count={count}
                  label={markerCategoryLabel(category)}
                  onClick={() => toggleCategory(category)}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {mode === "full" && actionsBlock}
    </div>
  );
}
