"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAppStore, type MarkerDraft } from "@/lib/store/useAppStore";
import { cn } from "@/lib/utils";
import { MapPin, Trash2, Pencil } from "lucide-react";
import { MARKER_CATEGORIES, MARKER_STATE_COLORS, MARKER_STATES } from "@/lib/markers/constants";

const STATES = [...MARKER_STATES];
const CATEGORIES = [...MARKER_CATEGORIES];
const STATE_COLORS = MARKER_STATE_COLORS;

export function MarkerPanel({ serverMarkers, projectId, onSaved }: { serverMarkers: any[]; projectId: string | null; onSaved: () => void }) {
  const { markers, removeMarker, updateMarker, setShowMarkerPanel, logAction } = useAppStore();
  const [editing, setEditing] = useState<MarkerDraft | null>(null);
  const all = [...markers, ...serverMarkers];

  async function persistDraft(m: MarkerDraft) {
    if (!projectId) return;
    const r = await fetch("/api/markers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...m, projectId, layerId: m.layerId ?? null }) });
    if (r.ok) { removeMarker(m.id); onSaved(); logAction(`Marker saved: ${m.label}`); }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
        <span className="text-xs font-semibold">Markers ({all.length})</span>
        <button onClick={() => setShowMarkerPanel(false)} className="text-[10px] text-muted-foreground hover:text-foreground">hide</button>
      </div>
      <div className="scrollbar-thin flex-1 overflow-y-auto p-1.5">
        {all.length === 0 && <div className="px-1 py-2 text-xs text-muted-foreground">No markers. Click "Add marker" then click the map, or Deep Analyze → Add to layer.</div>}
        {all.map((m: any) => (
          <div key={m.id} className="mb-1 flex items-center gap-2 rounded border border-border bg-background/40 px-2 py-1 text-xs">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: m.color }} />
            <div className="min-w-0 flex-1">
              <div className="truncate">{m.label}</div>
              <div className="text-[10px] text-muted-foreground">{m.state} · {m.category}{m.sizeM2 ? ` · ${m.sizeM2}m²` : ""} · {m.source}</div>
            </div>
            <button onClick={() => setEditing(m)} className="text-muted-foreground hover:text-foreground"><Pencil className="h-3 w-3" /></button>
            <button onClick={() => { if (!m.source || m.source === "user") { removeMarker(m.id); logAction(`Marker removed: ${m.label}`, { severity: "warning" }); } }} className="text-muted-foreground hover:text-red-400"><Trash2 className="h-3 w-3" /></button>
            {!serverMarkers.find((x) => x.id === m.id) && <button onClick={() => persistDraft(m)} className="text-[10px] text-primary hover:underline">save</button>}
          </div>
        ))}
      </div>
      {editing && <MarkerEditor marker={editing} onSave={(patch) => { updateMarker(editing.id, patch); logAction(`Marker edited: ${patch.label ?? editing.label}`); setEditing(null); }} onClose={() => setEditing(null)} />}
    </div>
  );
}

export function MarkerEditor({ marker, onSave, onClose }: { marker: MarkerDraft; onSave: (patch: Partial<MarkerDraft>) => void; onClose: () => void }) {
  const [label, setLabel] = useState(marker.label);
  const [state, setState] = useState(marker.state);
  const [category, setCategory] = useState(marker.category);
  const [sizeM2, setSizeM2] = useState(marker.sizeM2?.toString() ?? "");
  const [notes, setNotes] = useState(marker.notes ?? "");
  const color = STATE_COLORS[state] ?? marker.color;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle className="flex items-center gap-1.5 text-sm"><MapPin className="h-4 w-4" />Edit marker</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <div className="space-y-1"><Label>Label</Label><Input value={label} onChange={(e) => setLabel(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label>State</Label><Select value={state} onValueChange={setState}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label>Category</Label><Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="space-y-1"><Label>Size (m²)</Label><Input type="number" value={sizeM2} onChange={(e) => setSizeM2(e.target.value)} /></div>
          <div className="space-y-1"><Label>Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter><Button onClick={() => onSave({ label, state, category, color, sizeM2: sizeM2 ? Number(sizeM2) : null, notes })}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
