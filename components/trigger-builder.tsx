"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { HazardType } from "@/lib/types";
import { HAZARD_LABELS } from "@/lib/types";
import { useToast } from "@/components/ui/toaster";
import { useAppStore } from "@/lib/store/useAppStore";
import { Zap } from "lucide-react";

const METRICS = [
  { v: "risk_score", l: "Overall risk score" },
  { v: "active_fire_count", l: "Active fire count" },
  { v: "earthquake_magnitude", l: "Earthquake magnitude" },
  { v: "wind_speed", l: "Wind speed (km/h)" },
  { v: "rainfall_24h", l: "Rainfall 24h (mm)" },
  { v: "drought_anomaly", l: "Drought risk" },
  { v: "exposed_buildings", l: "Exposed buildings" },
  { v: "event_count", l: "Event count" },
  { v: "confidence", l: "Confidence (0-1)" },
  { v: "gdacs_alert_level", l: "GDACS alert count" },
  { v: "trend_change", l: "Trend change" },
];
const OPERATORS = [">", ">=", "<", "<=", "==", "change_gt"];
const ACTIONS = [
  { v: "dashboard_alert", l: "Dashboard alert" },
  { v: "email", l: "Email (mock)" },
  { v: "sms", l: "SMS (mock)" },
  { v: "webhook", l: "Webhook (mock)" },
  { v: "llm_brief", l: "Generate LLM brief" },
  { v: "incident_task", l: "Create incident task" },
];

export function TriggerBuilder({ open, onOpenChange, zoneId }: { open: boolean; onOpenChange: (o: boolean) => void; zoneId?: string | null }) {
  const { toast } = useToast();
  const pushFeed = useAppStore((s) => s.pushFeed);
  const [hazard, setHazard] = useState<HazardType>("wildfire");
  const [metric, setMetric] = useState("risk_score");
  const [operator, setOperator] = useState(">");
  const [threshold, setThreshold] = useState("80");
  const [duration, setDuration] = useState("10");
  const [cooldown, setCooldown] = useState("30");
  const [actions, setActions] = useState<string[]>(["dashboard_alert"]);
  const [loading, setLoading] = useState(false);

  const opWord: Record<string, string> = { ">": "above", ">=": "at or above", "<": "below", "<=": "at or below", "==": "equal to", change_gt: "increases by more than" };
  const preview = `Alert when ${HAZARD_LABELS[hazard].toLowerCase()} ${metric.replace(/_/g, " ")} is ${opWord[operator]} ${threshold}${Number(duration) ? ` for ${duration} min` : ""}.`;

  async function create() {
    setLoading(true);
    const r = await fetch("/api/triggers", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ zoneId, hazard, metric, operator, threshold: Number(threshold), durationMinutes: Number(duration), cooldownMinutes: Number(cooldown), actions: actions.map((type) => ({ type })), naturalLanguage: preview, name: `${HAZARD_LABELS[hazard]} ${metric} ${operator} ${threshold}` }),
    });
    setLoading(false);
    if (r.ok) {
      const d = await r.json();
      toast({ title: "Trigger created", description: preview, variant: "success" });
      pushFeed({ id: Math.random().toString(36).slice(2), type: "trigger_fired", message: `Trigger created: ${preview}`, severity: "info", timestamp: new Date().toISOString(), meta: { triggerId: d.trigger?.id } });
      onOpenChange(false);
    } else {
      toast({ title: "Failed to create trigger", variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle className="flex items-center gap-1.5"><Zap className="h-4 w-4 text-amber-400" />Trigger Builder</DialogTitle><DialogDescription>Programmable alerting on risk metrics for this watch zone.</DialogDescription></DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1"><Label>Hazard</Label><Select value={hazard} onValueChange={(v) => setHazard(v as HazardType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(HAZARD_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label>Metric</Label><Select value={metric} onValueChange={setMetric}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{METRICS.map((m) => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label>Operator</Label><Select value={operator} onValueChange={setOperator}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{OPERATORS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label>Threshold</Label><Input type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} /></div>
          <div className="space-y-1"><Label>Duration (min)</Label><Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} /></div>
          <div className="space-y-1"><Label>Cooldown (min)</Label><Input type="number" value={cooldown} onChange={(e) => setCooldown(e.target.value)} /></div>
        </div>
        <div className="space-y-1">
          <Label>Actions</Label>
          <div className="flex flex-wrap gap-3 rounded-md border border-border p-2">
            {ACTIONS.map((a) => (
              <label key={a.v} className="flex items-center gap-1.5 text-xs">
                <Switch checked={actions.includes(a.v)} onCheckedChange={(c) => setActions((p) => c ? [...p, a.v] : p.filter((x) => x !== a.v))} />
                {a.l}
              </label>
            ))}
          </div>
        </div>
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-200">{preview}</div>
        <DialogFooter><Button disabled={loading} onClick={create}>{loading ? "Creating…" : "Create trigger"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
