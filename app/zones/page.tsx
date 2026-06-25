"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toaster";
import { cn, timeAgo } from "@/lib/utils";
import { HAZARD_LABELS } from "@/lib/types";
import { Trash2, Zap, Play, ShieldX, ShieldCheck } from "lucide-react";

export default function ZonesPage() {
  const { toast } = useToast();
  const [zones, setZones] = useState<any[]>([]);
  const [triggers, setTriggers] = useState<any[]>([]);
  const [evaluating, setEvaluating] = useState(false);

  const load = useCallback(() => {
    fetch("/api/zones").then((r) => r.json()).then((d) => setZones(d.zones ?? [])).catch(() => {});
    fetch("/api/triggers").then((r) => r.json()).then((d) => setTriggers(d.triggers ?? [])).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  async function deleteZone(id: string) {
    await fetch(`/api/zones/${id}`, { method: "DELETE" });
    load();
  }
  async function deleteTrigger(id: string) {
    await fetch(`/api/triggers/${id}`, { method: "DELETE" });
    load();
  }
  async function toggleTrigger(t: any) {
    await fetch(`/api/triggers/${t.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: !t.enabled }) });
    load();
  }
  async function evaluate() {
    setEvaluating(true);
    const r = await fetch("/api/triggers/evaluate", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const d = await r.json();
    setEvaluating(false);
    toast({ title: `${d.count ?? 0} alert(s) fired`, description: `${d.evaluated ?? 0} triggers evaluated`, variant: (d.count ?? 0) > 0 ? "warning" : "default" });
  }

  return (
    <div className="scrollbar-thin h-full overflow-y-auto p-4">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Watch Zones & Triggers</h1>
            <p className="text-xs text-muted-foreground">Saved regions and programmable alert rules. Draw and save new zones from the Command center.</p>
          </div>
          <Button size="sm" onClick={evaluate} disabled={evaluating}><Play className="h-3.5 w-3.5" />{evaluating ? "Evaluating…" : "Evaluate triggers"}</Button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Card className="p-3">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Watch Zones ({zones.length})</div>
            {zones.length === 0 ? <p className="py-6 text-center text-xs text-muted-foreground">No saved zones. Draw a region in the Command center and click Save.</p> : (
              <div className="space-y-1.5">
                {zones.map((z) => (
                  <div key={z.id} className="rounded-md border border-border bg-background/40 p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{z.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">{timeAgo(z.createdAt)}</span>
                        <button onClick={() => deleteZone(z.id)} className="text-muted-foreground hover:text-red-400"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(z.hazards ?? []).map((h: string) => <Badge key={h} variant="outline" className="text-[9px]">{HAZARD_LABELS[h as keyof typeof HAZARD_LABELS] ?? h}</Badge>)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-3">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Trigger Rules ({triggers.length})</div>
            {triggers.length === 0 ? <p className="py-6 text-center text-xs text-muted-foreground">No triggers. Open the Trigger Builder from a watch zone.</p> : (
              <div className="space-y-1.5">
                {triggers.map((t) => (
                  <div key={t.id} className={cn("rounded-md border p-2", t.enabled ? "border-border bg-background/40" : "border-border bg-background/20 opacity-70")}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <Zap className={cn("h-3 w-3 shrink-0", t.enabled ? "text-amber-400" : "text-muted-foreground")} />
                        <span className="truncate text-xs font-medium">{t.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Switch checked={t.enabled} onCheckedChange={() => toggleTrigger(t)} />
                        <button onClick={() => deleteTrigger(t.id)} className="text-muted-foreground hover:text-red-400"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    </div>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{t.naturalLanguage}</p>
                    <div className="mt-1 flex items-center gap-2 text-[10px]">
                      {t.lastFired ? <><ShieldCheck className="h-2.5 w-2.5 text-emerald-400" />fired {timeAgo(t.lastFired)}</> : <><ShieldX className="h-2.5 w-2.5 text-muted-foreground" />never fired</>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
