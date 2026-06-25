"use client";

import { useEffect, useState } from "react";
import { cn, timeAgo } from "@/lib/utils";
import type { FeedEvent } from "@/lib/types";
import { Activity, AlertTriangle, Flame, Waves, Wind, Sparkles, ScanLine, Bell } from "lucide-react";
import { useAppStore } from "@/lib/store/useAppStore";

const ICONS: Record<FeedEvent["type"], React.ElementType> = {
  firms_detection: Flame, earthquake: Activity, rainfall_anomaly: Waves, wind_spike: Wind,
  trigger_fired: Bell, llm_brief: Sparkles, deep_analysis: ScanLine, system: AlertTriangle,
};
const COLORS: Record<FeedEvent["severity"], string> = { info: "text-sky-400", warning: "text-amber-400", critical: "text-red-400" };

export function EventTimeline({ external }: { external?: FeedEvent[] }) {
  const storeFeed = useAppStore((s) => s.feed);
  const feed = [...storeFeed, ...(external ?? [])].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 40);
  if (!feed.length) return <div className="px-1 text-xs text-muted-foreground">No events yet.</div>;
  return (
    <div className="space-y-0.5">
      {feed.map((e) => {
        const Icon = ICONS[e.type] ?? Activity;
        return (
          <div key={e.id} className="flex items-start gap-2 rounded px-1.5 py-1 text-xs hover:bg-accent/50">
            <Icon className={cn("mt-0.5 h-3 w-3 shrink-0", COLORS[e.severity])} />
            <div className="min-w-0 flex-1">
              <span className="text-foreground/90">{e.message}</span>
              <span className="ml-1 text-[10px] text-muted-foreground">{timeAgo(e.timestamp)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AlertFeed() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const load = () => fetch("/api/alerts").then((r) => r.json()).then((d) => setAlerts(d.alerts ?? [])).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!alerts.length) return <div className="px-1 text-xs text-muted-foreground">No triggered alerts.</div>;
  return (
    <div className="space-y-1.5">
      {alerts.map((a) => (
        <div key={a.id} className={cn("rounded-md border p-2", a.acknowledged ? "border-border bg-background/30 opacity-70" : "border-red-500/30 bg-red-500/5")}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">{a.triggerName}</span>
            <span className="text-[10px] text-muted-foreground">{timeAgo(a.createdAt)}</span>
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">{a.message}</div>
          <div className="mt-1 flex items-center gap-2">
            <span className={cn("rounded px-1 py-0.5 text-[9px]", a.severity === "Severe" ? "bg-red-500/20 text-red-300" : a.severity === "High" ? "bg-orange-500/20 text-orange-300" : "bg-amber-500/20 text-amber-300")}>{a.severity}</span>
            {!a.acknowledged && <button onClick={async () => { await fetch(`/api/alerts/${a.id}`, { method: "PATCH" }); load(); }} className="text-[10px] text-primary hover:underline">acknowledge</button>}
          </div>
        </div>
      ))}
    </div>
  );
}
