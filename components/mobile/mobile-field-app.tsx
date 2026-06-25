"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Layers, X, ChevronDown, Sun, Moon, Check, Clock, ArrowRight,
  Loader2, MapPin, RefreshCw, Navigation, Users,
} from "lucide-react";
import { MobileMap, type MobileMarker } from "@/components/mobile/mobile-map";
import { usePresence } from "@/lib/realtime/use-presence";
import { useTheme } from "@/components/theme-provider";
import {
  MARKER_STATES, MARKER_STATE_LABELS, MARKER_STATE_COLORS,
  MARKER_CATEGORIES, markerCategoryLabel,
} from "@/lib/markers/constants";
import { markerCategoryIcon } from "@/lib/map/icons";
import { cn, timeAgo } from "@/lib/utils";

interface StatusEvent { from: string | null; state: string; byId: string | null; byName: string | null; at: string }
interface ApiMarker {
  id: string; projectId: string; layerId: string | null; geometry: GeoJSON.Point;
  label: string | null; color: string; state: string; category: string;
  source: string; notes: string | null; createdBy: string;
  statusHistory: StatusEvent[]; createdAt: string; updatedAt: string;
}
interface Layer { id: string; name: string; color: string; visible: boolean }
interface Project { id: string; name: string; defaultLat: number; defaultLng: number; defaultZoom: number }

const ALL = "all";
const SHARE_OPTIN_KEY = "sentry-mobile-share-optin";

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=${60 * 60 * 24 * 30}`;
}
function readCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

const CATEGORY_QUICK = ["observation", "house", "shelter", "hospital", "school", "fire", "flood", "custom"];

export function MobileFieldApp() {
  const router = useRouter();
  const { theme, toggle: toggleTheme } = useTheme();

  const [ready, setReady] = useState(false);
  const [meId, setMeId] = useState<string | null>(null);
  const [shareLocation, setShareLocation] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [markers, setMarkers] = useState<ApiMarker[]>([]);

  const [layerFilter, setLayerFilter] = useState<string>(ALL);
  const [addMode, setAddMode] = useState(false);
  const [pendingPoint, setPendingPoint] = useState<[number, number] | null>(null);
  const [draftCategory, setDraftCategory] = useState("observation");
  const [draftState, setDraftState] = useState("pending");
  const [draftLabel, setDraftLabel] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<null | "layers" | "projects">(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 2600);
  }, []);

  // ---- bootstrap -----------------------------------------------------------
  const loadProjectData = useCallback(async (projectId: string) => {
    const [lr, mr] = await Promise.all([
      fetch(`/api/layers?projectId=${projectId}`).then((r) => r.json()).catch(() => ({ layers: [] })),
      fetch(`/api/markers?projectId=${projectId}`).then((r) => r.json()).catch(() => ({ markers: [] })),
    ]);
    setLayers(lr.layers ?? []);
    setMarkers(mr.markers ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const me = await fetch("/api/auth/me").then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (!me?.user) { router.replace("/login"); return; }
      if (!cancelled) setMeId(me.user.id);

      const ws = await fetch("/api/workspaces").then((r) => r.json()).catch(() => ({ workspaces: [] }));
      const list = ws.workspaces ?? [];
      if (!list.length) { router.replace("/setup"); return; }
      const wsId = list.find((w: any) => w.id === readCookie("dos_workspace"))?.id ?? list[0].id;
      setCookie("dos_workspace", wsId);

      const pr = await fetch("/api/projects").then((r) => r.json()).catch(() => ({ projects: [] }));
      const plist: Project[] = pr.projects ?? [];
      if (cancelled) return;
      setProjects(plist);
      if (!plist.length) { setReady(true); return; }
      const pid = plist.find((p) => p.id === readCookie("dos_project"))?.id ?? plist[0].id;
      setActiveProjectId(pid);
      setCookie("dos_project", pid);
      await loadProjectData(pid);
      if (!cancelled) setReady(true);
    })();
    return () => { cancelled = true; };
  }, [router, loadProjectData]);

  const switchProject = useCallback(async (pid: string) => {
    setActiveProjectId(pid);
    setCookie("dos_project", pid);
    setLayerFilter(ALL);
    setSelectedId(null);
    setSheet(null);
    setMarkers([]);
    setLayers([]);
    await loadProjectData(pid);
  }, [loadProjectData]);

  const refresh = useCallback(async () => {
    if (!activeProjectId) return;
    setBusy(true);
    await loadProjectData(activeProjectId);
    setBusy(false);
    flash("Refreshed");
  }, [activeProjectId, loadProjectData, flash]);

  // ---- live presence -------------------------------------------------------
  const { peers, connected, geoError } = usePresence({
    projectId: activeProjectId,
    selfId: meId,
    share: shareLocation,
    device: "mobile",
  });

  useEffect(() => { if (geoError) flash(geoError); }, [geoError, flash]);

  // Force every field user to make a location-sharing decision before using the
  // app. Previously-opted-in users resume sharing automatically.
  useEffect(() => {
    if (!ready) return;
    try {
      if (localStorage.getItem(SHARE_OPTIN_KEY) === "yes") setShareLocation(true);
      else setShowConsent(true);
    } catch {
      setShowConsent(true);
    }
  }, [ready]);

  const enableSharing = useCallback(() => {
    try { localStorage.setItem(SHARE_OPTIN_KEY, "yes"); } catch { /* ignore */ }
    setShareLocation(true);
    setShowConsent(false);
  }, []);

  // ---- derived -------------------------------------------------------------
  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;

  const visibleMarkers = useMemo(
    () => (layerFilter === ALL ? markers : markers.filter((m) => m.layerId === layerFilter)),
    [markers, layerFilter],
  );

  const mapMarkers: MobileMarker[] = useMemo(
    () => visibleMarkers.map((m) => ({
      id: m.id, geometry: m.geometry, label: m.label, color: m.color, state: m.state, category: m.category,
    })),
    [visibleMarkers],
  );

  const layerCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    let unassigned = 0;
    for (const m of markers) {
      if (m.layerId) counts[m.layerId] = (counts[m.layerId] ?? 0) + 1;
      else unassigned += 1;
    }
    return { counts, unassigned };
  }, [markers]);

  const selected = markers.find((m) => m.id === selectedId) ?? null;

  const initialCenter: [number, number] = useMemo(() => {
    if (markers.length) return markers[0].geometry.coordinates as [number, number];
    if (activeProject && (activeProject.defaultLat || activeProject.defaultLng)) {
      return [activeProject.defaultLng, activeProject.defaultLat];
    }
    return [10, 20];
  }, [markers, activeProject]);
  const initialZoom = markers.length ? 12 : activeProject?.defaultZoom || 2;

  // ---- actions -------------------------------------------------------------
  const onMapTap = useCallback((lngLat: [number, number]) => {
    setPendingPoint(lngLat);
    setSelectedId(null);
  }, []);

  const saveMarker = useCallback(async () => {
    if (!pendingPoint || !activeProjectId) return;
    setBusy(true);
    try {
      const body = {
        projectId: activeProjectId,
        layerId: layerFilter === ALL ? null : layerFilter,
        geometry: { type: "Point", coordinates: pendingPoint },
        category: draftCategory,
        state: draftState,
        color: MARKER_STATE_COLORS[draftState],
        label: draftLabel.trim() || null,
        source: "user",
      };
      const r = await fetch("/api/markers", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "failed");
      const created: ApiMarker = (d.markers?.[0] ?? d.marker);
      if (created) setMarkers((prev) => [created, ...prev]);
      setPendingPoint(null);
      setAddMode(false);
      setDraftLabel("");
      flash("Marker added");
    } catch {
      flash("Couldn't save marker");
    } finally {
      setBusy(false);
    }
  }, [pendingPoint, activeProjectId, layerFilter, draftCategory, draftState, draftLabel, flash]);

  const changeStatus = useCallback(async (id: string, state: string) => {
    setBusy(true);
    try {
      const r = await fetch(`/api/markers/${id}/status`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "failed");
      setMarkers((prev) => prev.map((m) => (m.id === id ? d.marker : m)));
      flash(`Status → ${MARKER_STATE_LABELS[state as keyof typeof MARKER_STATE_LABELS] ?? state}`);
    } catch {
      flash("Couldn't update status");
    } finally {
      setBusy(false);
    }
  }, [flash]);

  // ---- render --------------------------------------------------------------
  if (!ready) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 h-screen w-screen overflow-hidden bg-background text-foreground" style={{ height: "100dvh" }}>
      {/* map */}
      <div className="absolute inset-0 h-full w-full">
        <MobileMap
          markers={mapMarkers}
          peers={peers}
          theme={theme}
          addMode={addMode}
          pendingPoint={pendingPoint}
          center={initialCenter}
          zoom={initialZoom}
          onMapTap={onMapTap}
          onMarkerTap={(id) => { setSelectedId(id); setPendingPoint(null); }}
        />

        {/* top header */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2 p-3"
          style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              onClick={() => setSheet("projects")}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-card/95 px-3 py-2 shadow-lg backdrop-blur"
            >
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/15 text-primary"><MapPin className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Field · Project</span>
                <span className="block truncate text-sm font-semibold">{activeProject?.name ?? "No project"}</span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
            <button
              onClick={() => setShareLocation((v) => !v)}
              className={cn(
                "pointer-events-auto grid h-10 w-10 place-items-center rounded-xl border shadow-lg backdrop-blur",
                shareLocation ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card/95",
              )}
              aria-label="Share my location"
            >
              <Navigation className={cn("h-4 w-4", shareLocation && "animate-pulse")} />
            </button>
            <button onClick={refresh} className="pointer-events-auto grid h-10 w-10 place-items-center rounded-xl border border-border bg-card/95 shadow-lg backdrop-blur">
              <RefreshCw className={cn("h-4 w-4", busy && "animate-spin")} />
            </button>
            <button onClick={toggleTheme} className="pointer-events-auto grid h-10 w-10 place-items-center rounded-xl border border-border bg-card/95 shadow-lg backdrop-blur">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>

          {/* layer filter chips */}
          <div className="pointer-events-auto -mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <FilterChip active={layerFilter === ALL} onClick={() => setLayerFilter(ALL)} label={`All layers`} count={markers.length} />
            {layers.map((l) => (
              <FilterChip
                key={l.id}
                active={layerFilter === l.id}
                onClick={() => setLayerFilter(l.id)}
                label={l.name}
                count={layerCounts.counts[l.id] ?? 0}
                color={l.color}
              />
            ))}
          </div>

          {(peers.length > 0 || shareLocation) && (
            <div className="pointer-events-auto flex items-center gap-2 self-start rounded-full border border-border bg-card/95 px-3 py-1.5 text-xs shadow-lg backdrop-blur">
              <Users className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium">{peers.length} live</span>
              {peers.length > 0 && (
                <div className="flex -space-x-1.5">
                  {peers.slice(0, 6).map((p) => (
                    <span key={p.userId} title={p.name}
                      className="h-4 w-4 rounded-full border-2 border-card" style={{ background: p.color }} />
                  ))}
                </div>
              )}
              {shareLocation && (
                <span className={cn("ml-1 inline-flex items-center gap-1", connected ? "text-emerald-500" : "text-amber-500")}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current" /> sharing
                </span>
              )}
            </div>
          )}
        </div>

        {/* add-mode banner */}
        {addMode && !pendingPoint && (
          <div className="absolute inset-x-0 bottom-28 z-10 flex justify-center px-4">
            <div className="flex items-center gap-2 rounded-full border border-primary/40 bg-card/95 px-4 py-2 text-sm shadow-lg backdrop-blur">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              Tap the map to drop a marker
            </div>
          </div>
        )}

        {/* bottom action bar */}
        <div className="absolute inset-x-0 bottom-0 z-10 flex items-center gap-3 p-4"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
          <button
            onClick={() => setSheet("layers")}
            className="grid h-12 w-12 place-items-center rounded-2xl border border-border bg-card/95 shadow-lg backdrop-blur"
            aria-label="Layer overview"
          >
            <Layers className="h-5 w-5" />
          </button>
          <button
            onClick={() => { setAddMode((v) => !v); setPendingPoint(null); }}
            className={cn(
              "flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl text-sm font-semibold shadow-lg transition-colors",
              addMode ? "bg-red-500 text-white" : "bg-primary text-primary-foreground",
            )}
          >
            {addMode ? <><X className="h-5 w-5" /> Cancel</> : <><Plus className="h-5 w-5" /> Add marker</>}
          </button>
        </div>
      </div>

      {/* toast */}
      {toast && (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-30 flex justify-center">
          <div className="rounded-full bg-foreground/90 px-4 py-2 text-sm font-medium text-background shadow-xl">{toast}</div>
        </div>
      )}

      {/* create sheet */}
      {pendingPoint && (
        <Sheet onClose={() => { setPendingPoint(null); }} title="New marker">
          <div className="space-y-4">
            <div>
              <SheetLabel>Type</SheetLabel>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_QUICK.map((c) => {
                  const Icon = markerCategoryIcon(c);
                  return (
                    <button key={c} onClick={() => setDraftCategory(c)}
                      className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm",
                        draftCategory === c ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground")}>
                      <Icon className="h-3.5 w-3.5" /> {markerCategoryLabel(c)}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <SheetLabel>Status</SheetLabel>
              <div className="flex flex-wrap gap-2">
                {MARKER_STATES.map((s) => (
                  <StateChip key={s} state={s} active={draftState === s} onClick={() => setDraftState(s)} />
                ))}
              </div>
            </div>
            <div>
              <SheetLabel>Label (optional)</SheetLabel>
              <input
                value={draftLabel}
                onChange={(e) => setDraftLabel(e.target.value)}
                placeholder="e.g. Blocked road, Shelter #3"
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
            </div>
            <button onClick={saveMarker} disabled={busy}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Check className="h-5 w-5" /> Save marker</>}
            </button>
          </div>
        </Sheet>
      )}

      {/* detail sheet */}
      {selected && (
        <MarkerDetailSheet
          marker={selected}
          busy={busy}
          layerName={layers.find((l) => l.id === selected.layerId)?.name ?? "Unassigned"}
          onClose={() => setSelectedId(null)}
          onChangeStatus={(s) => changeStatus(selected.id, s)}
        />
      )}

      {/* layers overview sheet */}
      {sheet === "layers" && (
        <Sheet onClose={() => setSheet(null)} title="Layers overview">
          <div className="space-y-1">
            <OverviewRow
              label="All layers" count={markers.length} color="#64748b"
              active={layerFilter === ALL}
              onClick={() => { setLayerFilter(ALL); setSheet(null); }}
            />
            {layers.map((l) => (
              <OverviewRow
                key={l.id} label={l.name} count={layerCounts.counts[l.id] ?? 0} color={l.color}
                active={layerFilter === l.id}
                onClick={() => { setLayerFilter(l.id); setSheet(null); }}
              />
            ))}
            {layerCounts.unassigned > 0 && (
              <div className="px-1 pt-2 text-xs text-muted-foreground">{layerCounts.unassigned} marker(s) with no layer</div>
            )}
            {!layers.length && <div className="py-6 text-center text-sm text-muted-foreground">No layers in this project yet.</div>}
          </div>
        </Sheet>
      )}

      {/* projects sheet */}
      {sheet === "projects" && (
        <Sheet onClose={() => setSheet(null)} title="Switch project">
          <div className="space-y-1">
            {projects.map((p) => (
              <button key={p.id} onClick={() => switchProject(p.id)}
                className={cn("flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left text-sm",
                  p.id === activeProjectId ? "border-primary bg-primary/10" : "border-border")}>
                <span className="truncate font-medium">{p.name}</span>
                {p.id === activeProjectId && <Check className="h-4 w-4 text-primary" />}
              </button>
            ))}
            {!projects.length && <div className="py-6 text-center text-sm text-muted-foreground">No projects yet.</div>}
          </div>
        </Sheet>
      )}

      {/* forced location-sharing opt-in gate */}
      {showConsent && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-background/80 p-4 backdrop-blur-sm sm:items-center"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
          <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-2xl">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 text-primary">
              <Navigation className="h-7 w-7" />
            </div>
            <h2 className="mt-4 text-center text-lg font-bold">Share your live location</h2>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Field coordination requires your location so the operations center can see where the
              team is deployed in real time. Your position is only visible to coordinators on this project.
            </p>
            <button
              onClick={enableSharing}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-semibold text-primary-foreground"
            >
              <Navigation className="h-5 w-5" /> Enable location sharing
            </button>
            <p className="mt-3 text-center text-[11px] text-muted-foreground">
              Your device will ask for location permission. You can pause sharing anytime from the header.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- subcomponents ---------------------------------------------------------

function FilterChip({ active, onClick, label, count, color }: { active: boolean; onClick: () => void; label: string; count: number; color?: string }) {
  return (
    <button onClick={onClick}
      className={cn("flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur",
        active ? "border-primary bg-primary/20 text-foreground" : "border-border bg-card/95 text-muted-foreground")}>
      {color && <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />}
      {label}
      <span className={cn("rounded-full px-1.5 text-[10px]", active ? "bg-primary/30" : "bg-muted")}>{count}</span>
    </button>
  );
}

function StateChip({ state, active, onClick }: { state: string; active: boolean; onClick: () => void }) {
  const color = MARKER_STATE_COLORS[state] ?? "#94a3b8";
  return (
    <button onClick={onClick}
      className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm",
        active ? "text-foreground" : "border-border text-muted-foreground")}
      style={active ? { borderColor: color, background: `${color}22` } : undefined}>
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {MARKER_STATE_LABELS[state as keyof typeof MARKER_STATE_LABELS] ?? state}
    </button>
  );
}

function OverviewRow({ label, count, color, active, onClick }: { label: string; count: number; color: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={cn("flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left",
        active ? "border-primary bg-primary/10" : "border-border")}>
      <span className="h-3 w-3 rounded-full" style={{ background: color }} />
      <span className="flex-1 truncate text-sm font-medium">{label}</span>
      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{count}</span>
    </button>
  );
}

function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative max-h-[80%] overflow-y-auto rounded-t-3xl border-t border-border bg-card p-4 shadow-2xl"
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}>
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted" />
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SheetLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{children}</div>;
}

function StatusBadge({ state }: { state: string }) {
  const color = MARKER_STATE_COLORS[state] ?? "#94a3b8";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ background: `${color}22`, color }}>
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {MARKER_STATE_LABELS[state as keyof typeof MARKER_STATE_LABELS] ?? state}
    </span>
  );
}

function MarkerDetailSheet({ marker, layerName, busy, onClose, onChangeStatus }: {
  marker: ApiMarker; layerName: string; busy: boolean; onClose: () => void; onChangeStatus: (s: string) => void;
}) {
  const Icon = markerCategoryIcon(marker.category);
  const history = [...(marker.statusHistory ?? [])].reverse(); // newest first
  const creation = (marker.statusHistory ?? [])[0];
  const creator = creation?.byName ?? (marker.createdBy ? marker.createdBy.slice(0, 8) : "Unknown");

  return (
    <Sheet onClose={onClose} title={marker.label || markerCategoryLabel(marker.category)}>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl text-white shadow" style={{ background: marker.color }}>
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold">{markerCategoryLabel(marker.category)}</span>
              <StatusBadge state={marker.state} />
            </div>
            <div className="truncate text-xs text-muted-foreground">{layerName}</div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-background/60 px-3 py-2 text-xs text-muted-foreground">
          Created by <span className="font-medium text-foreground">{creator}</span> · {timeAgo(marker.createdAt)}
        </div>

        <div>
          <SheetLabel>Change status</SheetLabel>
          <div className="flex flex-wrap gap-2">
            {MARKER_STATES.map((s) => (
              <StateChip key={s} state={s} active={marker.state === s} onClick={() => !busy && onChangeStatus(s)} />
            ))}
          </div>
        </div>

        <div>
          <SheetLabel>History</SheetLabel>
          <div className="space-y-2">
            {history.length === 0 && <div className="text-sm text-muted-foreground">No history recorded.</div>}
            {history.map((h, i) => (
              <div key={i} className="flex items-start gap-2.5 rounded-xl border border-border bg-background/40 px-3 py-2">
                <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {h.from ? (
                      <>
                        <StatusBadge state={h.from} />
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <StatusBadge state={h.state} />
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-muted-foreground">Created as</span> <StatusBadge state={h.state} />
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    {h.from ? "Changed" : "Set"} by <span className="font-medium text-foreground">{h.byName ?? (h.byId ? h.byId.slice(0, 8) : "Unknown")}</span> · {timeAgo(h.at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Sheet>
  );
}
