"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { MapCommandCenter, type BasemapStyle } from "@/components/map-command-center";
import { HazardLayerSidebar } from "@/components/hazard-layer-sidebar";
import { WatchZoneInspector } from "@/components/watch-zone-inspector";
import { MarkerPanel } from "@/components/marker-panel";
import { EventTimeline } from "@/components/alert-feed";
import { useAppStore, type MarkerDraft } from "@/lib/store/useAppStore";
import { filterEventsByLayers, activeHazardTypes } from "@/lib/layers";
import { artifactMatchesLayerFilter } from "@/lib/artifact-layers";
import { AnalyzeRegionDialog } from "@/components/analyze-region-dialog";
import { useWorkspace } from "@/components/workspace-provider";
import { usePresence } from "@/lib/realtime/use-presence";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MARKER_STATE_LABELS, markerCategoryLabel } from "@/lib/markers/constants";
import { PenLine, MapPin, X, PanelBottom, Activity, Check } from "lucide-react";
import type { HazardEvent, WatchZone } from "@/lib/types";

const stateLabel = (s: string) => MARKER_STATE_LABELS[s as keyof typeof MARKER_STATE_LABELS] ?? s;
const markerLabelOf = (m: any) => m.label || markerCategoryLabel(m.category);

export function CommandCenterPage() {
  const store = useAppStore();
  const { ready: workspaceReady } = useWorkspace();
  const { theme } = useTheme();
  const {
    drawMode, setDrawMode, setSelected, addMarker, logAction, activeProjectId, activeWorkspaceId,
    showMarkerPanel, setShowMarkerPanel, markers, setMarkers, osmOverlay, setOsmOverlay, layers,
    setVertexRing, bumpRegions, activeLayerId, projectLayers,
  } = store;
  const [events, setEvents] = useState<HazardEvent[]>([]);
  const [serverMarkers, setServerMarkers] = useState<any[]>([]);
  const [flyTarget, setFlyTarget] = useState<{ polygon: GeoJSON.Polygon; nonce: number } | null>(null);
  const [markerFlyTarget, setMarkerFlyTarget] = useState<{ point: GeoJSON.Point; nonce: number } | null>(null);
  const [showAnalyzeDialog, setShowAnalyzeDialog] = useState(false);
  const [basemap, setBasemap] = useState<BasemapStyle>("map");
  const [meId, setMeId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => (r.ok ? r.json() : null)).then((d) => setMeId(d?.user?.id ?? null)).catch(() => {});
  }, []);

  // live collaborators (view-only on desktop — field teams share from /mobile)
  const { peers: livePeers } = usePresence({ projectId: activeProjectId ?? null, selfId: null, share: false, device: "desktop" });

  const visibleLocalMarkers = useMemo(
    () => markers.filter((m) => artifactMatchesLayerFilter(m.layerId, activeLayerId, projectLayers)),
    [markers, activeLayerId, projectLayers],
  );
  const visibleServerMarkers = useMemo(
    () => serverMarkers.filter((m) => artifactMatchesLayerFilter(m.layerId, activeLayerId, projectLayers)),
    [serverMarkers, activeLayerId, projectLayers],
  );

  const loadEvents = useCallback(() => {
    fetch("/api/hazards").then((r) => r.json()).then((d) => setEvents(d.events ?? [])).catch(() => {});
  }, []);

  // Baseline for change-detection across polls. null = next load is a baseline
  // (no feed entries) — used on first load and project switches.
  const prevMarkersRef = useRef<Map<string, any> | null>(null);

  // Diff polled markers against the previous snapshot and surface changes made
  // elsewhere (e.g. the /mobile field app) into the activity feed. Changes
  // attributed to this same user are skipped — we already log those locally.
  const applyMarkers = useCallback((list: any[]) => {
    setServerMarkers(list);
    const prev = prevMarkersRef.current;
    if (prev) {
      const next = new Map(list.map((m) => [m.id, m]));
      for (const m of list) {
        const old = prev.get(m.id);
        const hist = m.statusHistory ?? [];
        const last = hist[hist.length - 1];
        if (!old) {
          if (last?.byId !== meId) {
            logAction(`New marker: ${markerLabelOf(m)} (${stateLabel(m.state)})${last?.byName ? ` · ${last.byName}` : ""}`);
          }
        } else if (old.state !== m.state || hist.length > (old.statusHistory?.length ?? 0)) {
          if (last && last.byId !== meId) {
            const from = last.from ? `${stateLabel(last.from)} → ` : "";
            logAction(`${last.byName ?? "Someone"} set ${markerLabelOf(m)}: ${from}${stateLabel(m.state)}`, {
              severity: m.state === "destroyed" || m.state === "damaged" ? "warning" : "info",
            });
          }
        }
      }
      for (const old of prev.values()) {
        if (!next.has(old.id)) logAction(`Marker removed: ${markerLabelOf(old)}`, { severity: "warning" });
      }
    }
    prevMarkersRef.current = new Map(list.map((m) => [m.id, m]));
  }, [meId, logAction]);

  const loadMarkers = useCallback(() => {
    if (!activeProjectId) { setServerMarkers([]); prevMarkersRef.current = null; return; }
    fetch(`/api/markers?projectId=${activeProjectId}`).then((r) => r.json()).then((d) => applyMarkers(d.markers ?? [])).catch(() => {});
  }, [activeProjectId, applyMarkers]);

  useEffect(() => { loadEvents(); const t = setInterval(loadEvents, 60000); return () => clearInterval(t); }, [loadEvents]);
  // re-baseline on project change, then poll for remote marker changes
  useEffect(() => {
    prevMarkersRef.current = null;
    loadMarkers();
    const t = setInterval(loadMarkers, 12000);
    return () => clearInterval(t);
  }, [loadMarkers]);

  const globalCounts = filterEventsByLayers(events, layers).reduce((acc, e) => { acc[e.type] = (acc[e.type] ?? 0) + 1; return acc; }, {} as Record<string, number>);

  function onRegionSelect(zone: WatchZone) {
    setSelected(zone.geometry, zone.name, zone.id);
    setDrawMode("none");
    setVertexRing(null);
    logAction(`Loaded region: ${zone.name}`);
  }

  function onRegionFlyTo(poly: GeoJSON.Polygon) {
    setFlyTarget({ polygon: poly, nonce: Date.now() });
  }

  function onMarkerFlyTo(point: GeoJSON.Point) {
    setMarkerFlyTarget({ point, nonce: Date.now() });
  }

  async function onPolygonComplete(poly: GeoJSON.Polygon) {
    const name = `Custom Zone ${new Date().toLocaleTimeString()}`;
    setSelected(poly, name);
    logAction("Region drawn on map");
    if (!activeProjectId) {
      logAction("Region not auto-saved — create or select a project first", { severity: "warning" });
      return;
    }
    try {
      const hazardList = activeHazardTypes(layers);
      const hazards = hazardList.length ? hazardList : ["wildfire", "drought", "flood"];
      const r = await fetch("/api/zones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, geometry: poly, hazards, projectId: activeProjectId, layerId: activeLayerId ?? null }),
      });
      const d = await r.json();
      if (!r.ok || !d.zone) throw new Error(d.error ?? "save failed");
      setSelected(poly, name, d.zone.id);
      bumpRegions();
      logAction(`Region auto-saved: ${name}`);
    } catch {
      logAction(`Auto-save failed for ${name}`, { severity: "warning" });
    }
  }

  function onMarkerComplete(m: MarkerDraft) {
    addMarker({ ...m, layerId: m.layerId ?? activeLayerId ?? null });
    setShowMarkerPanel(true);
    logAction(`Marker added: ${m.label}`);
  }

  function toggleDrawRegion() {
    if (drawMode === "polygon") {
      setDrawMode("none");
      setVertexRing(null);
    } else {
      setDrawMode("polygon");
      setVertexRing([]);
    }
  }

  function clearAll() {
    setSelected(null);
    store.setAnalysis(null);
    store.setSectors([]);
    setMarkers([]);
    setOsmOverlay(null);
    setVertexRing(null);
    setDrawMode("none");
    logAction("Cleared map selection and unsaved markers");
  }

  return (
    <div className="flex h-full w-full">
      <HazardLayerSidebar
        onRegionSelect={onRegionSelect}
        onRegionFlyTo={onRegionFlyTo}
        onMarkerFlyTo={onMarkerFlyTo}
        onArtifactsChanged={loadMarkers}
      />

      <div className="relative flex flex-1 flex-col">
        {workspaceReady && activeWorkspaceId && !activeProjectId && (
          <div className="pointer-events-none absolute inset-x-0 bottom-[7.75rem] z-20 mx-auto max-w-md rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-100 shadow-lg backdrop-blur">
            Create a project in the top bar to save regions, markers, and analysis.
          </div>
        )}

        <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-lg border border-border bg-card/95 p-1.5 shadow-lg backdrop-blur">
          <Button size="sm" variant={drawMode === "polygon" ? "default" : "ghost"} className={cn("h-8 px-2.5 text-xs", drawMode === "polygon" && "bg-cyan-600 hover:bg-cyan-600")} onClick={toggleDrawRegion}>
            <PenLine className="h-3.5 w-3.5" />Draw region
          </Button>
          <Button size="sm" variant={drawMode === "marker" ? "default" : "ghost"} className={cn("h-8 px-2.5 text-xs", drawMode === "marker" && "bg-amber-500 hover:bg-amber-500 text-black")} onClick={() => setDrawMode(drawMode === "marker" ? "none" : "marker")}>
            <MapPin className="h-3.5 w-3.5" />Add marker
          </Button>
          {drawMode === "edit" && (
            <Button size="sm" variant="secondary" className="h-8 px-2.5 text-xs" onClick={() => { setDrawMode("none"); setVertexRing(null); }}>
              <Check className="h-3.5 w-3.5" />Done editing
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-8 px-2.5 text-xs" onClick={clearAll}>
            <X className="h-3.5 w-3.5" />Clear
          </Button>
          <div className="mx-1 h-5 w-px bg-border" />
          <Button size="sm" variant="ghost" className="h-8 px-2.5 text-xs" onClick={() => setShowMarkerPanel(!showMarkerPanel)}>
            <PanelBottom className="h-3.5 w-3.5" />Markers ({markers.length + serverMarkers.length})
          </Button>
        </div>

        {drawMode !== "none" && (
          <div className={cn(
            "absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full border px-4 py-1.5 text-xs font-medium shadow-lg backdrop-blur",
            drawMode === "polygon" && "border-cyan-400/50 bg-cyan-500/15 text-cyan-100",
            drawMode === "marker" && "border-amber-400/50 bg-amber-500/15 text-amber-100",
            drawMode === "edit" && "border-violet-400/50 bg-violet-500/15 text-violet-100",
          )}>
            {drawMode === "polygon" && "Click to add points · drag vertices · snap to first point to close · Enter to finish · Esc to cancel"}
            {drawMode === "marker" && "Click the map to drop a marker"}
            {drawMode === "edit" && "Drag vertices · snaps to nearby points · auto-saves on release · Enter or Done when finished"}
          </div>
        )}

        <div className="relative flex-1">
          <MapCommandCenter
            events={events}
            serverMarkers={visibleServerMarkers}
            localMarkers={visibleLocalMarkers}
            buildings={osmOverlay?.buildings}
            roads={osmOverlay?.roads}
            facilities={osmOverlay?.facilities}
            initialCenter={[42, 2]}
            initialZoom={4.2}
            theme={theme}
            basemap={basemap}
            peers={livePeers}
            flyTarget={flyTarget}
            markerFlyTarget={markerFlyTarget}
            onPolygonComplete={onPolygonComplete}
            onMarkerComplete={onMarkerComplete}
            onZoneGeometrySaved={() => bumpRegions()}
          />
          {showMarkerPanel && (
            <div className="absolute bottom-3 left-3 z-10 w-60 rounded-md border border-border bg-card/95 shadow-lg backdrop-blur">
              <MarkerPanel serverMarkers={serverMarkers} projectId={activeProjectId} onSaved={loadMarkers} />
            </div>
          )}
          {livePeers.length > 0 && (
            <div className="absolute left-3 top-16 z-10 w-52 overflow-hidden rounded-md border border-border bg-card/95 shadow-lg backdrop-blur">
              <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500/70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {livePeers.length} volunteer{livePeers.length === 1 ? "" : "s"} live
                </span>
              </div>
              <div className="max-h-44 overflow-y-auto py-1">
                {livePeers.map((p) => (
                  <button
                    key={p.userId}
                    onClick={() => setMarkerFlyTarget({ point: { type: "Point", coordinates: [p.lng, p.lat] }, nonce: Date.now() })}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-accent"
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-card" style={{ backgroundColor: p.color }} />
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">{p.name}</span>
                    <span className="shrink-0 text-[10px] uppercase text-muted-foreground">{p.device ?? "field"}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="absolute bottom-6 right-2 z-10 flex overflow-hidden rounded-md border border-border bg-card/95 shadow-lg backdrop-blur">
            {(["map", "satellite"] as const).map((b) => (
              <button
                key={b}
                onClick={() => setBasemap(b)}
                className={cn(
                  "px-2.5 py-1 text-[11px] font-medium capitalize transition-colors",
                  basemap === b ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {b}
              </button>
            ))}
          </div>
        </div>

        <div className="h-28 shrink-0 border-t border-border bg-card/40">
          <div className="flex h-full flex-col px-3 py-1.5">
            <div className="mb-0.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Activity className="h-3 w-3" />Event Feed
            </div>
            <div className="scrollbar-thin flex-1 overflow-y-auto">
              <EventTimeline />
            </div>
          </div>
        </div>
      </div>

      <WatchZoneInspector globalEventCounts={globalCounts} onOpenAnalyze={() => setShowAnalyzeDialog(true)} onMarkersChanged={loadMarkers} />

      <AnalyzeRegionDialog
        open={showAnalyzeDialog}
        onOpenChange={setShowAnalyzeDialog}
        onRegionSelect={onRegionSelect}
        onDrawRegion={() => { setDrawMode("polygon"); setVertexRing([]); }}
      />
    </div>
  );
}
