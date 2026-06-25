"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/lib/store/useAppStore";
import { openRing } from "@/lib/polygon-edit";
import { artifactMatchesLayerFilter } from "@/lib/artifact-layers";
import { CollapsibleSection } from "@/components/collapsible-section";
import type { WatchZone } from "@/lib/types";
import { cn, timeAgo } from "@/lib/utils";
import { MapPin, Pencil, Trash2, Check, X, Loader2, Tag, Shapes, ChevronDown, Type } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";

interface MarkerRow {
  id: string;
  label: string | null;
  color: string;
  state: string;
  category: string;
  source: string;
  layerId: string | null;
  geometry: GeoJSON.Point;
}

interface SegmentRow {
  id: string;
  label: string | null;
  color: string;
  state: string;
  layerId: string | null;
  geometry: GeoJSON.Polygon;
}

interface Props {
  onRegionSelect: (zone: WatchZone) => void;
  onRegionFlyTo: (poly: GeoJSON.Polygon) => void;
  onMarkerFlyTo?: (point: GeoJSON.Point) => void;
  onArtifactsChanged?: () => void;
  /** Analyze dialog: regions only, flat list */
  compact?: boolean;
}

export function ProjectArtifactsPanel({
  onRegionSelect,
  onRegionFlyTo,
  onMarkerFlyTo,
  onArtifactsChanged,
  compact = false,
}: Props) {
  const { toast } = useToast();
  const {
    activeProjectId, activeLayerId, projectLayers,
    selectedZoneId, drawMode, setDrawMode, setVertexRing, setSelected,
    artifactsNonce, bumpArtifacts, logAction,
  } = useAppStore();

  const [zones, setZones] = useState<WatchZone[]>([]);
  const [markers, setMarkers] = useState<MarkerRow[]>([]);
  const [segments, setSegments] = useState<SegmentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!activeProjectId) {
      setZones([]);
      setMarkers([]);
      setSegments([]);
      return;
    }
    setLoading(true);
    Promise.all([
      fetch(`/api/zones?projectId=${activeProjectId}`).then((r) => r.json()),
      compact ? Promise.resolve({ markers: [] }) : fetch(`/api/markers?projectId=${activeProjectId}`).then((r) => r.json()),
      compact ? Promise.resolve({ segments: [] }) : fetch(`/api/segments?projectId=${activeProjectId}`).then((r) => r.json()),
    ])
      .then(([z, m, s]) => {
        setZones(z.zones ?? []);
        setMarkers(m.markers ?? []);
        setSegments(s.segments ?? []);
      })
      .catch(() => {
        setZones([]);
        setMarkers([]);
        setSegments([]);
      })
      .finally(() => setLoading(false));
  }, [activeProjectId, compact]);

  useEffect(() => { load(); }, [load, artifactsNonce]);

  const visibleZones = useMemo(
    () => zones.filter((z) => artifactMatchesLayerFilter(z.layerId, activeLayerId, projectLayers)),
    [zones, activeLayerId, projectLayers],
  );
  const visibleMarkers = useMemo(
    () => markers.filter((m) => artifactMatchesLayerFilter(m.layerId, activeLayerId, projectLayers)),
    [markers, activeLayerId, projectLayers],
  );
  const visibleSegments = useMemo(
    () => segments.filter((s) => artifactMatchesLayerFilter(s.layerId, activeLayerId, projectLayers)),
    [segments, activeLayerId, projectLayers],
  );

  const sections = useMemo(() => ({
    zones: visibleZones,
    markers: compact ? [] as MarkerRow[] : visibleMarkers,
    segments: compact ? [] as SegmentRow[] : visibleSegments,
  }), [visibleZones, visibleMarkers, visibleSegments, compact]);

  async function moveArtifact(kind: "zone" | "marker" | "segment", id: string, layerId: string | null) {
    setBusyId(id);
    const url = kind === "zone" ? `/api/zones/${id}` : kind === "marker" ? `/api/markers/${id}` : `/api/segments/${id}`;
    const r = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ layerId }),
    });
    setBusyId(null);
    if (r.ok) {
      bumpArtifacts();
      onArtifactsChanged?.();
      const layerName = layerId ? (projectLayers.find((l) => l.id === layerId)?.name ?? "layer") : "no layer";
      logAction(`Moved ${kind} to ${layerName}`);
      toast({ title: "Moved to layer", variant: "success" });
    } else {
      toast({ title: "Move failed", variant: "destructive" });
    }
  }

  async function deleteZone(id: string) {
    setBusyId(id);
    const r = await fetch(`/api/zones/${id}`, { method: "DELETE" });
    setBusyId(null);
    if (r.ok) {
      if (selectedZoneId === id) {
        setSelected(null);
        setVertexRing(null);
        setDrawMode("none");
      }
      bumpArtifacts();
      onArtifactsChanged?.();
      logAction(`Region deleted`, { severity: "warning" });
      toast({ title: "Region deleted", variant: "success" });
    } else {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  }

  async function deleteMarker(id: string) {
    setBusyId(id);
    const r = await fetch(`/api/markers/${id}`, { method: "DELETE" });
    setBusyId(null);
    if (r.ok) {
      bumpArtifacts();
      onArtifactsChanged?.();
      logAction(`Marker deleted`, { severity: "warning" });
      toast({ title: "Label deleted", variant: "success" });
    } else {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  }

  async function saveRename(id: string) {
    if (!editName.trim()) return;
    setBusyId(id);
    const r = await fetch(`/api/zones/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim() }),
    });
    setBusyId(null);
    if (r.ok) {
      logAction(`Region renamed to ${editName.trim()}`);
      setEditingZoneId(null);
      bumpArtifacts();
      toast({ title: "Region renamed", variant: "success" });
    } else {
      toast({ title: "Rename failed", variant: "destructive" });
    }
  }

  function selectZone(z: WatchZone) {
    onRegionSelect(z);
    onRegionFlyTo(z.geometry);
  }

  function startEditShape(z: WatchZone) {
    selectZone(z);
    setVertexRing(openRing(z.geometry));
    setDrawMode("edit");
  }

  function renderZone(z: WatchZone) {
    const active = selectedZoneId === z.id;
    const editing = editingZoneId === z.id;
    const editingShape = active && drawMode === "edit";
    return (
      <ArtifactCard key={`z-${z.id}`} active={active}>
        {editing ? (
          <div className="flex items-center gap-1">
            <Input className="h-7 flex-1 text-xs" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus onKeyDown={(e) => { if (e.key === "Enter") saveRename(z.id); if (e.key === "Escape") setEditingZoneId(null); }} />
            <IconBtn onClick={() => saveRename(z.id)} title="Save"><Check className="h-3.5 w-3.5 text-emerald-400" /></IconBtn>
            <IconBtn onClick={() => setEditingZoneId(null)} title="Cancel"><X className="h-3.5 w-3.5" /></IconBtn>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <button onClick={() => selectZone(z)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
              <MapPin className={cn("h-3.5 w-3.5 shrink-0", active ? "text-cyan-400" : "text-muted-foreground")} />
              <div className="min-w-0">
                <div className="truncate text-xs font-medium">{z.name}</div>
                <div className="truncate text-[10px] text-muted-foreground">{timeAgo(z.createdAt)} · {z.hazards?.length ?? 0} hazards</div>
              </div>
            </button>
            <InlineActions busy={busyId === z.id}>
              {!compact && <LayerMoveSelect layers={projectLayers} value={z.layerId ?? null} onChange={(lid) => moveArtifact("zone", z.id, lid)} />}
              <IconBtn onClick={() => { setEditingZoneId(z.id); setEditName(z.name); }} title="Rename"><Type className="h-3 w-3" /></IconBtn>
              <IconBtn onClick={() => startEditShape(z)} title="Edit shape" active={editingShape}><Pencil className="h-3 w-3" /></IconBtn>
              <IconBtn onClick={() => deleteZone(z.id)} title="Delete" danger disabled={busyId === z.id}>
                {busyId === z.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              </IconBtn>
            </InlineActions>
          </div>
        )}
      </ArtifactCard>
    );
  }

  function renderMarker(m: MarkerRow) {
    return (
      <ArtifactCard key={`m-${m.id}`}>
        <div className="flex items-center gap-1">
          <button onClick={() => onMarkerFlyTo?.(m.geometry)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
            <Tag className="h-3.5 w-3.5 shrink-0" style={{ color: m.color }} />
            <div className="min-w-0">
              <div className="truncate text-xs font-medium">{m.label || "Untitled label"}</div>
              <div className="truncate text-[10px] text-muted-foreground">{m.state} · {m.category}</div>
            </div>
          </button>
          <InlineActions busy={busyId === m.id}>
            <LayerMoveSelect layers={projectLayers} value={m.layerId} onChange={(lid) => moveArtifact("marker", m.id, lid)} />
            <IconBtn onClick={() => deleteMarker(m.id)} title="Delete" danger disabled={busyId === m.id}>
              {busyId === m.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            </IconBtn>
          </InlineActions>
        </div>
      </ArtifactCard>
    );
  }

  function renderSegment(s: SegmentRow) {
    return (
      <ArtifactCard key={`s-${s.id}`}>
        <div className="flex items-center gap-1">
          <button onClick={() => onRegionFlyTo(s.geometry)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
            <Shapes className="h-3.5 w-3.5 shrink-0" style={{ color: s.color }} />
            <div className="min-w-0">
              <div className="truncate text-xs font-medium">{s.label || "Segment"}</div>
              <div className="truncate text-[10px] text-muted-foreground">{s.state}</div>
            </div>
          </button>
          <InlineActions busy={busyId === s.id}>
            <LayerMoveSelect layers={projectLayers} value={s.layerId} onChange={(lid) => moveArtifact("segment", s.id, lid)} />
          </InlineActions>
        </div>
      </ArtifactCard>
    );
  }

  if (!activeProjectId) {
    return <p className="px-2 py-3 text-[11px] text-muted-foreground">Select a project to view artifacts.</p>;
  }

  if (loading && zones.length === 0 && markers.length === 0 && segments.length === 0) {
    return (
      <div className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
      </div>
    );
  }

  const total = visibleZones.length + visibleMarkers.length + visibleSegments.length;
  if (total === 0 && !compact) {
    return (
      <p className="px-2 py-3 text-[11px] text-muted-foreground">
        No artifacts yet. Draw regions or add labels on the map, then save from the inspector.
      </p>
    );
  }

  if (compact) {
    return <div className="space-y-1">{sections.zones.map(renderZone)}</div>;
  }

  return (
    <div className="space-y-1.5">
      <CollapsibleSection
        id="artifacts-regions"
        title="Regions"
        hint="Saved watch zones"
        count={sections.zones.length}
        defaultOpen={sections.zones.length > 0}
        className="border-none bg-transparent"
      >
        <div className="space-y-1">
          {sections.zones.length === 0 ? (
            <p className="px-1 py-1 text-[10px] text-muted-foreground">No saved regions</p>
          ) : sections.zones.map(renderZone)}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        id="artifacts-markers"
        title="Markers"
        hint="Building labels & pins"
        count={sections.markers.length}
        defaultOpen={sections.markers.length > 0 && sections.markers.length <= 20}
        className="border-none bg-transparent"
      >
        <div className="max-h-52 space-y-1 overflow-y-auto scrollbar-thin">
          {sections.markers.length === 0 ? (
            <p className="px-1 py-1 text-[10px] text-muted-foreground">No markers</p>
          ) : sections.markers.map(renderMarker)}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        id="artifacts-segments"
        title="Segments"
        hint="Drawn hazard segments"
        count={sections.segments.length}
        defaultOpen={sections.segments.length > 0}
        className="border-none bg-transparent"
      >
        <div className="space-y-1">
          {sections.segments.length === 0 ? (
            <p className="px-1 py-1 text-[10px] text-muted-foreground">No segments</p>
          ) : sections.segments.map(renderSegment)}
        </div>
      </CollapsibleSection>
    </div>
  );
}

function ArtifactCard({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <div className={cn(
      "rounded-md border px-1.5 py-1 transition-colors",
      active ? "border-cyan-500/40 bg-cyan-500/10" : "border-transparent hover:border-border hover:bg-accent/50",
    )}>
      {children}
    </div>
  );
}

function InlineActions({ children, busy }: { children: React.ReactNode; busy?: boolean }) {
  return (
    <div className={cn("flex shrink-0 items-center gap-0.5", busy && "opacity-100")}>
      {children}
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  danger,
  active,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  danger?: boolean;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      disabled={disabled}
      title={title}
      className={cn(
        "rounded p-1 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50",
        danger && "hover:bg-red-500/10 hover:text-red-400",
        active && "bg-cyan-500/20 text-cyan-300",
        !danger && !active && "hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function LayerMoveSelect({ layers, value, onChange }: { layers: { id: string; name: string; color: string }[]; value: string | null; onChange: (layerId: string | null) => void }) {
  if (layers.length === 0) return null;
  return (
    <div className="relative">
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        onClick={(e) => e.stopPropagation()}
        className="h-6 w-[4.5rem] cursor-pointer appearance-none rounded border border-border/60 bg-background/80 pl-1 pr-4 text-[9px] text-muted-foreground hover:text-foreground"
        title="Move to layer"
      >
        <option value="">—</option>
        {layers.map((l) => (
          <option key={l.id} value={l.id}>{l.name}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-0.5 top-1/2 h-2.5 w-2.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
