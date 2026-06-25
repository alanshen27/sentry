"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { RiskScoreCard, HazardScoreList } from "@/components/risk-cards";
import { ExposurePanel, CriticalAssetsTable } from "@/components/exposure-panel";
import { LLMBriefCard } from "@/components/llm-brief-card";
import { DeepAnalysisPanel } from "@/components/deep-analysis-panel";
import { DataSourceStatus } from "@/components/data-source-status";
import { TriggerBuilder } from "@/components/trigger-builder";
import { useAppStore } from "@/lib/store/useAppStore";
import { useToast } from "@/components/ui/toaster";
import type { HazardType } from "@/lib/types";
import { HAZARD_LABELS, HAZARD_COLORS } from "@/lib/types";
import { hazardIcon } from "@/lib/map/icons";
import { activeHazardTypes } from "@/lib/layers";
import { cn } from "@/lib/utils";
import { ScanLine, Zap, X, Brain, ChevronsLeft, ChevronsRight, PenLine, Sparkles } from "lucide-react";
import { PendingMarkerImport } from "@/components/pending-marker-import";
import type { PendingMarkerBreakdown } from "@/lib/markers/summary";

const INSPECTOR_MIN_W = 300;
const INSPECTOR_MAX_W = 760;
const INSPECTOR_DEFAULT_W = 340;
const INSPECTOR_EXPANDED_W = 560;
const INSPECTOR_WIDTH_KEY = "sentry-inspector-width";

function clampInspectorWidth(w: number): number {
  if (Number.isNaN(w)) return INSPECTOR_DEFAULT_W;
  return Math.min(INSPECTOR_MAX_W, Math.max(INSPECTOR_MIN_W, w));
}

function useInspectorWidth() {
  const [width, setWidth] = useState(INSPECTOR_DEFAULT_W);
  const drag = useRef({ active: false, startX: 0, startW: INSPECTOR_DEFAULT_W });

  useEffect(() => {
    try {
      const stored = localStorage.getItem(INSPECTOR_WIDTH_KEY);
      if (stored) setWidth(clampInspectorWidth(Number(stored)));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (!drag.current.active) return;
      const delta = drag.current.startX - e.clientX; // dragging left widens
      setWidth(clampInspectorWidth(drag.current.startW + delta));
    }
    function onUp() {
      if (!drag.current.active) return;
      drag.current.active = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setWidth((w) => { try { localStorage.setItem(INSPECTOR_WIDTH_KEY, String(w)); } catch { /* ignore */ } return w; });
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, []);

  function startDrag(e: React.PointerEvent) {
    e.preventDefault();
    drag.current = { active: true, startX: e.clientX, startW: width };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  function toggleExpand() {
    setWidth((w) => {
      const next = w >= INSPECTOR_EXPANDED_W ? INSPECTOR_DEFAULT_W : INSPECTOR_EXPANDED_W;
      try { localStorage.setItem(INSPECTOR_WIDTH_KEY, String(next)); } catch { /* ignore */ }
      return next;
    });
  }

  return { width, startDrag, toggleExpand, expanded: width >= INSPECTOR_EXPANDED_W };
}

function ResizeHandle({ onPointerDown }: { onPointerDown: (e: React.PointerEvent) => void }) {
  return (
    <div
      onPointerDown={onPointerDown}
      title="Drag to resize"
      className="group absolute left-0 top-0 z-20 flex h-full w-2 -translate-x-1/2 cursor-col-resize items-center justify-center"
    >
      <div className="h-full w-px bg-transparent transition-colors group-hover:bg-primary/60" />
    </div>
  );
}

function ExpandButton({ expanded, onClick }: { expanded: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={expanded ? "Collapse panel" : "Expand panel"}
      className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {expanded ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
    </button>
  );
}

function QuickStep({ n, icon, title, body }: { n: number; icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-md border border-border/60 bg-background/30 px-2.5 py-2">
      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500/15 text-[10px] font-semibold text-cyan-300">{n}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-xs font-medium">{icon}{title}</div>
        <div className="text-[10px] text-muted-foreground">{body}</div>
      </div>
    </div>
  );
}

function roughAreaKm2(poly: GeoJSON.Polygon): number {
  const ring = poly.coordinates[0];
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  }
  const deg2 = Math.abs(a / 2);
  const lat = ring[0][1];
  return Number((deg2 * 111 * 111 * Math.cos((lat * Math.PI) / 180)).toFixed(0));
}

export function WatchZoneInspector({ globalEventCounts, onOpenAnalyze, onMarkersChanged }: { globalEventCounts: Record<string, number>; onOpenAnalyze?: () => void; onMarkersChanged?: () => void }) {
  const store = useAppStore();
  const { toast } = useToast();
  const { selectedGeometry, selectedZoneId, zoneName, analysis, analyzing, deepAnalysisSteps, setAnalyzing, setAnalysis, setSectors, setDeepSteps, pushFeed, logAction, setShowTriggerBuilder, showTriggerBuilder, activeProjectId, activeLayerId, projectLayers, layers, setOsmOverlay, bumpArtifacts, bumpLayers } = store;
  const [briefLoading, setBriefLoading] = useState(false);
  const [pendingMarkerBreakdown, setPendingMarkerBreakdown] = useState<PendingMarkerBreakdown | null>(null);
  const [selectedMarkerStates, setSelectedMarkerStates] = useState<string[]>([]);
  const [selectedMarkerCategories, setSelectedMarkerCategories] = useState<string[]>([]);
  const [assignLayerId, setAssignLayerId] = useState<string>("");
  const [importingMarkers, setImportingMarkers] = useState(false);
  const { width, startDrag, toggleExpand, expanded } = useInspectorWidth();

  useEffect(() => {
    setPendingMarkerBreakdown(null);
    setSelectedMarkerStates([]);
    setSelectedMarkerCategories([]);
    setAssignLayerId(activeLayerId ?? projectLayers[0]?.id ?? "");
  }, [selectedZoneId, selectedGeometry, activeLayerId, projectLayers]);

  if (!selectedGeometry) {
    return (
      <aside style={{ width }} className="relative flex h-full shrink-0 flex-col border-l border-border bg-card/50">
        <ResizeHandle onPointerDown={startDrag} />
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <h2 className="text-sm font-semibold">Inspector</h2>
          <ExpandButton expanded={expanded} onClick={toggleExpand} />
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto p-3 space-y-3">
          <div className="relative overflow-hidden rounded-lg border border-border bg-gradient-to-b from-cyan-500/10 to-transparent p-5 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-500/10">
              <ScanLine className="h-6 w-6 text-cyan-300" />
            </div>
            <h3 className="text-sm font-semibold">Analyze a region</h3>
            <p className="mx-auto mt-1 max-w-[15rem] text-xs text-muted-foreground">
              Pick a saved or demo area, or draw one on the map, to compute risk, exposure, and an operational brief.
            </p>
            {onOpenAnalyze && (
              <Button size="sm" className="mt-3" onClick={onOpenAnalyze}><ScanLine className="h-3.5 w-3.5" />Choose region</Button>
            )}
          </div>

          <div className="space-y-1.5">
            <QuickStep n={1} icon={<PenLine className="h-3.5 w-3.5 text-cyan-300" />} title="Select or draw" body="Choose a region or sketch one on the map." />
            <QuickStep n={2} icon={<ScanLine className="h-3.5 w-3.5 text-cyan-300" />} title="Analyze" body="Risk scores, sectors & exposed assets." />
            <QuickStep n={3} icon={<Sparkles className="h-3.5 w-3.5 text-cyan-300" />} title="Deep Analyze" body="Add an AI operational brief & building markers." />
          </div>

          <Card className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Live hazards (global)</span>
              <span className="text-[10px] tabular-nums text-muted-foreground">{Object.values(globalEventCounts).reduce((a, b) => a + b, 0)} events</span>
            </div>
            {Object.keys(globalEventCounts).length === 0 ? (
              <p className="text-xs text-muted-foreground">No active hazard events right now.</p>
            ) : (
              <div className="space-y-1">
                {Object.entries(globalEventCounts).sort((a, b) => b[1] - a[1]).map(([k, v]) => {
                  const Icon = hazardIcon(k);
                  return (
                    <div key={k} className="flex items-center gap-2 rounded bg-background/40 px-2 py-1 text-xs">
                      <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: HAZARD_COLORS[k as HazardType] ?? "currentColor" }} />
                      <span className="flex-1 truncate text-foreground/90">{HAZARD_LABELS[k as HazardType] ?? k}</span>
                      <span className="font-semibold tabular-nums text-muted-foreground">{v}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
        <div className="shrink-0 border-t border-border/50 px-3 py-2">
          <DataSourceStatus variant="minimal" />
        </div>
      </aside>
    );
  }

  const hazardList = activeHazardTypes(layers);
  const hazards = hazardList.length ? hazardList : (["wildfire", "drought", "flood"] as HazardType[]);

  async function runAnalysis(deep: boolean) {
    if (!selectedGeometry) return;
    setPendingMarkerBreakdown(null);
    setSelectedMarkerStates([]);
    setSelectedMarkerCategories([]);
    setAnalyzing(true);
    setBriefLoading(true);
    if (deep) {
      setDeepSteps([
        { label: "Re-fetching latest hazard feeds", done: false },
        { label: "Loading buildings / roads / facilities", done: false },
        { label: "Segmenting region into sectors", done: false },
        { label: "Computing per-hazard risk + confidence", done: false },
        { label: "Evaluating building footprints (markers)", done: false },
        { label: "Generating LLM operational brief", done: false },
      ]);
    }
    const steps = deep ? useAppStore.getState().deepAnalysisSteps : [];
    if (deep) for (let i = 0; i < steps.length - 1; i++) { await new Promise((r) => setTimeout(r, 350)); steps[i].done = true; setDeepSteps([...steps]); }

    try {
      const r = await fetch("/api/analyze-region", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ geometry: selectedGeometry, hazards, deepAnalysis: deep, zoneName, projectId: activeProjectId ?? undefined }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "analysis failed");
      setAnalysis(d);
      setSectors(d.sectors ?? []);
      if (d.osm) {
        setOsmOverlay(d.osm);
        store.setLayers({ osm_buildings: true, osm_roads: true, critical_infra: true });
      }
      pushFeed({ id: Math.random().toString(36).slice(2), type: deep ? "deep_analysis" : "llm_brief", message: `${deep ? "Deep analysis" : "Analysis"} complete for ${zoneName || "zone"} (risk ${d.overallRisk}/100)`, severity: d.overallRisk >= 70 ? "critical" : "info", timestamp: new Date().toISOString() });
      if (deep) { steps.forEach((s) => (s.done = true)); setDeepSteps([...steps]); }
      const breakdown = d.pendingMarkerBreakdown as PendingMarkerBreakdown | null;
      setPendingMarkerBreakdown(breakdown);
      if (breakdown) {
        setSelectedMarkerStates(Object.keys(breakdown.byState));
        setSelectedMarkerCategories(Object.keys(breakdown.byCategory));
      }
      setAssignLayerId(activeLayerId ?? projectLayers[0]?.id ?? "");
      toast({
        title: `${deep ? "Deep analysis" : "Analysis"} complete`,
        description: breakdown?.total
          ? `${breakdown.total.toLocaleString()} building markers ready — scroll up to filter, add from bottom bar`
          : breakdown
            ? "No building footprints found in this region"
            : undefined,
        variant: "success",
      });
    } catch (e: any) {
      toast({ title: "Analysis failed", description: e.message, variant: "destructive" });
    } finally {
      setAnalyzing(false);
      setBriefLoading(false);
    }
  }

  async function importMarkersToLayer() {
    if (!pendingMarkerBreakdown || !activeProjectId || !selectedGeometry) return;
    if (!assignLayerId) {
      toast({ title: "Pick a layer first", description: "Select which project layer to add building markers to.", variant: "warning" });
      return;
    }
    if (!selectedMarkerStates.length || !selectedMarkerCategories.length) {
      toast({ title: "Nothing selected", description: "Enable at least one state and one type.", variant: "warning" });
      return;
    }
    setImportingMarkers(true);
    const r = await fetch("/api/markers/import-buildings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: activeProjectId,
        layerId: assignLayerId,
        geometry: selectedGeometry,
        hazards,
        states: selectedMarkerStates,
        categories: selectedMarkerCategories,
      }),
    });
    setImportingMarkers(false);
    const d = await r.json().catch(() => ({}));
    if (r.ok) {
      setPendingMarkerBreakdown(null);
      setSelectedMarkerStates([]);
      setSelectedMarkerCategories([]);
      bumpArtifacts();
      bumpLayers();
      onMarkersChanged?.();
      const name = projectLayers.find((l) => l.id === assignLayerId)?.name ?? "layer";
      toast({ title: `Added ${d.count ?? 0} markers to ${name}`, variant: "success" });
      logAction(`Imported ${d.count ?? 0} building markers into ${name}`);
    } else {
      toast({ title: "Could not add markers", description: d.error ?? "Import failed", variant: "destructive" });
    }
  }

  const markerImportProps = pendingMarkerBreakdown && pendingMarkerBreakdown.total > 0 ? {
    breakdown: pendingMarkerBreakdown,
    selectedStates: selectedMarkerStates,
    selectedCategories: selectedMarkerCategories,
    onStatesChange: setSelectedMarkerStates,
    onCategoriesChange: setSelectedMarkerCategories,
    assignLayerId,
    onLayerChange: setAssignLayerId,
    projectLayers,
    activeProjectId,
    importing: importingMarkers,
    onImport: importMarkersToLayer,
  } : null;

  return (
    <aside style={{ width }} className="relative flex h-full shrink-0 flex-col border-l border-border bg-card/50">
      <ResizeHandle onPointerDown={startDrag} />
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5"><span className="truncate text-sm font-semibold">{zoneName || "Selected Region"}</span></div>
          <div className="text-[10px] text-muted-foreground">{roughAreaKm2(selectedGeometry)} km² · {hazards.length} hazards monitored</div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <ExpandButton expanded={expanded} onClick={toggleExpand} />
          <button onClick={() => { store.setSelected(null); store.setAnalysis(null); store.setSectors([]); store.setOsmOverlay(null); setPendingMarkerBreakdown(null); setSelectedMarkerStates([]); setSelectedMarkerCategories([]); }} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="scrollbar-thin flex-1 overflow-y-auto p-2.5 space-y-2.5">
        {analysis ? (
          <>
            {markerImportProps && (
              <PendingMarkerImport {...markerImportProps} mode="filters" />
            )}
            <RiskScoreCard score={analysis.overallRisk} confidence={analysis.overallConfidence} />
            <div><div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Hazard Scores</div><HazardScoreList scores={analysis.riskScores} /></div>
            <DeepAnalysisPanel steps={deepAnalysisSteps} running={analyzing} />
            <div><div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Exposure</div><ExposurePanel assets={analysis.exposedAssets} /></div>
            <div><div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Critical assets</div><CriticalAssetsTable assets={analysis.exposedAssets} /></div>
            <LLMBriefCard brief={analysis.brief} loading={briefLoading} />
          </>
        ) : (
          <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            Region selected ({roughAreaKm2(selectedGeometry)} km²). Run <strong>Analyze</strong> for risk & exposure, then add building markers to a layer. <strong>Deep Analyze</strong> adds an AI-written brief.
          </div>
        )}
      </div>

      <div className="border-t border-border p-2 space-y-1.5">
        {markerImportProps && (
          <PendingMarkerImport {...markerImportProps} mode="actions" />
        )}
        <div className="grid grid-cols-2 gap-1.5">
          <Button size="sm" disabled={analyzing} onClick={() => runAnalysis(false)} title="Risk scores, sectors, exposure, building markers — no API key needed"><ScanLine className="h-3.5 w-3.5" />Analyze</Button>
          <Button size="sm" variant="secondary" disabled={analyzing} onClick={() => runAnalysis(true)} title="Everything in Analyze plus AI operational brief (requires OPENAI_API_KEY)"><Brain className="h-3.5 w-3.5" />Deep Analyze</Button>
        </div>
        <Button size="sm" variant="outline" className="w-full" onClick={() => setShowTriggerBuilder(true)}><Zap className="h-3.5 w-3.5" />Set alert trigger</Button>
        <DataSourceStatus variant="minimal" />
      </div>

      <TriggerBuilder open={showTriggerBuilder} onOpenChange={setShowTriggerBuilder} />
    </aside>
  );
}
