"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toaster";
import { timeAgo } from "@/lib/utils";
import { Plus, FolderKanban, Layers, Eye, EyeOff, Trash2 } from "lucide-react";

export default function ProjectsPage() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<any[]>([]);
  const [layersByProject, setLayersByProject] = useState<Record<string, any[]>>({});
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  const load = useCallback(() => {
    fetch("/api/projects").then((r) => r.json()).then((d) => {
      setProjects(d.projects ?? []);
      (d.projects ?? []).forEach((p: any) => {
        fetch(`/api/layers?projectId=${p.id}`).then((r) => r.json()).then((ld) => setLayersByProject((prev) => ({ ...prev, [p.id]: ld.layers ?? [] })));
      });
    }).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  async function create() {
    const r = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, description: desc }) });
    if (r.ok) { setOpen(false); setName(""); setDesc(""); toast({ title: "Project created", variant: "success" }); load(); }
  }
  async function toggleLayer(p: string, l: any) {
    setLayersByProject((prev) => ({ ...prev, [p]: (prev[p] ?? []).map((x) => x.id === l.id ? { ...x, visible: !l.visible } : x) }));
    await fetch(`/api/layers/${l.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visible: !l.visible }) });
  }

  return (
    <div className="scrollbar-thin h-full overflow-y-auto p-4">
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Projects & Layers</h1>
            <p className="text-xs text-muted-foreground">Multi-tenant workspaces. Each project groups layers, segments, markers and watch zones.</p>
          </div>
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5" />New project</Button>
        </div>

        {projects.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            <FolderKanban className="mx-auto mb-2 h-6 w-6 opacity-50" />
            No projects yet. Create one to start organising layers, segments and markers.
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {projects.map((p) => (
              <Card key={p.id} className="p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-semibold">{p.name}</div>
                    <div className="text-[10px] text-muted-foreground">created {timeAgo(p.createdAt)}</div>
                  </div>
                  <Badge variant="outline" className="text-[9px]">{(layersByProject[p.id] ?? []).length} layers</Badge>
                </div>
                {p.description && <p className="mt-1 text-xs text-muted-foreground">{p.description}</p>}
                <div className="mt-2 space-y-1">
                  <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground"><Layers className="h-3 w-3" />Layers</div>
                  {(layersByProject[p.id] ?? []).length === 0 && <p className="text-[10px] text-muted-foreground">No layers. Use the top bar to add one.</p>}
                  {(layersByProject[p.id] ?? []).map((l) => (
                    <div key={l.id} className="flex items-center gap-2 rounded bg-background/40 px-2 py-1 text-xs">
                      <span className="h-2 w-2 rounded-full" style={{ background: l.color }} />
                      <span className="flex-1 truncate">{l.name}</span>
                      <span className="text-[9px] text-muted-foreground">{l.type}</span>
                      <button onClick={() => toggleLayer(p.id, l)} className="text-muted-foreground hover:text-foreground">{l.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}</button>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New project</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <div className="space-y-1"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Horn of Africa Response" /></div>
            <div className="space-y-1"><Label>Description</Label><Input value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
          </div>
          <DialogFooter><Button disabled={!name} onClick={create}>Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
