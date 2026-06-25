"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppStore } from "@/lib/store/useAppStore";
import { openRing } from "@/lib/polygon-edit";
import type { WatchZone } from "@/lib/types";
import { cn, timeAgo } from "@/lib/utils";
import { MapPin, Pencil, Trash2, Check, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";

interface Props {
  onSelect: (zone: WatchZone) => void;
  onFlyTo: (poly: GeoJSON.Polygon) => void;
}

export function SavedRegionsPanel({ onSelect, onFlyTo }: Props) {
  const { toast } = useToast();
  const { activeProjectId, selectedZoneId, drawMode, setDrawMode, setVertexRing, setSelected, regionsNonce, bumpRegions } = useAppStore();
  const [zones, setZones] = useState<WatchZone[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!activeProjectId) { setZones([]); return; }
    setLoading(true);
    fetch(`/api/zones?projectId=${activeProjectId}`)
      .then((r) => r.json())
      .then((d) => setZones(d.zones ?? []))
      .catch(() => setZones([]))
      .finally(() => setLoading(false));
  }, [activeProjectId]);

  useEffect(() => { load(); }, [load, regionsNonce]);

  async function deleteZone(id: string) {
    setDeletingId(id);
    const r = await fetch(`/api/zones/${id}`, { method: "DELETE" });
    setDeletingId(null);
    if (r.ok) {
      if (selectedZoneId === id) {
        setSelected(null);
        setVertexRing(null);
        setDrawMode("none");
      }
      bumpRegions();
      toast({ title: "Region deleted", variant: "success" });
    } else {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  }

  async function saveRename(id: string) {
    if (!editName.trim()) return;
    const r = await fetch(`/api/zones/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim() }),
    });
    if (r.ok) {
      setEditingId(null);
      bumpRegions();
      toast({ title: "Region renamed", variant: "success" });
    } else {
      toast({ title: "Rename failed", variant: "destructive" });
    }
  }

  function selectZone(z: WatchZone) {
    onSelect(z);
    onFlyTo(z.geometry);
  }

  function startEditShape(z: WatchZone) {
    selectZone(z);
    setVertexRing(openRing(z.geometry));
    setDrawMode("edit");
  }

  if (!activeProjectId) {
    return (
      <p className="px-2 py-3 text-[11px] text-muted-foreground">
        Select a project to view saved regions.
      </p>
    );
  }

  if (loading && zones.length === 0) {
    return (
      <div className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
      </div>
    );
  }

  if (zones.length === 0) {
    return (
      <p className="px-2 py-3 text-[11px] text-muted-foreground">
        No saved regions yet. Draw a region on the map, then save it from the inspector.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {zones.map((z) => {
        const active = selectedZoneId === z.id;
        const editing = editingId === z.id;
        const editingShape = active && drawMode === "edit";
        return (
          <div
            key={z.id}
            className={cn(
              "group rounded-md border px-2 py-1.5 transition-colors",
              active ? "border-cyan-500/40 bg-cyan-500/10" : "border-transparent hover:border-border hover:bg-accent/50",
            )}
          >
            {editing ? (
              <div className="flex items-center gap-1">
                <Input className="h-7 text-xs" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus onKeyDown={(e) => { if (e.key === "Enter") saveRename(z.id); if (e.key === "Escape") setEditingId(null); }} />
                <button onClick={() => saveRename(z.id)} className="rounded p-1 text-emerald-400 hover:bg-accent"><Check className="h-3.5 w-3.5" /></button>
                <button onClick={() => setEditingId(null)} className="rounded p-1 text-muted-foreground hover:bg-accent"><X className="h-3.5 w-3.5" /></button>
              </div>
            ) : (
              <>
                <button onClick={() => selectZone(z)} className="flex w-full items-start gap-2 text-left">
                  <MapPin className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", active ? "text-cyan-400" : "text-muted-foreground")} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium">{z.name}</div>
                    <div className="text-[10px] text-muted-foreground">{timeAgo(z.createdAt)} · {z.hazards?.length ?? 0} hazards</div>
                  </div>
                </button>
                <div className="mt-1 flex items-center gap-0.5 pl-5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => { setEditingId(z.id); setEditName(z.name); }}
                    className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-accent hover:text-foreground"
                    title="Rename"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => startEditShape(z)}
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] hover:bg-accent",
                      editingShape ? "bg-cyan-500/20 text-cyan-300" : "text-muted-foreground hover:text-foreground",
                    )}
                    title="Edit shape on map"
                  >
                    <Pencil className="mr-0.5 inline h-3 w-3" />Shape
                  </button>
                  <button
                    onClick={() => deleteZone(z.id)}
                    disabled={deletingId === z.id}
                    className="ml-auto rounded p-1 text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
                    title="Delete"
                  >
                    {deletingId === z.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
