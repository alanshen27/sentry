"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn, timeAgo } from "@/lib/utils";
import { Bell, Check } from "lucide-react";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const load = useCallback(() => { fetch("/api/alerts").then((r) => r.json()).then((d) => setAlerts(d.alerts ?? [])).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);

  async function ack(id: string) { await fetch(`/api/alerts/${id}`, { method: "PATCH" }); load(); }

  const unacked = alerts.filter((a) => !a.acknowledged).length;

  return (
    <div className="scrollbar-thin h-full overflow-y-auto p-4">
      <div className="mx-auto max-w-4xl space-y-4">
        <div>
          <h1 className="text-lg font-semibold">Alerts & Response Briefs</h1>
          <p className="text-xs text-muted-foreground">{alerts.length} total · {unacked} unacknowledged</p>
        </div>
        {alerts.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            <Bell className="mx-auto mb-2 h-6 w-6 opacity-50" />
            No triggered alerts. Configure triggers in a watch zone, then run "Evaluate triggers".
          </Card>
        ) : (
          <div className="space-y-2">
            {alerts.map((a) => (
              <Card key={a.id} className={cn("p-3", a.acknowledged ? "opacity-70" : "border-red-500/30")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-semibold", a.severity === "Severe" ? "bg-red-500/20 text-red-300" : a.severity === "High" ? "bg-orange-500/20 text-orange-300" : "bg-amber-500/20 text-amber-300")}>{a.severity}</span>
                      <span className="text-sm font-medium">{a.triggerName}</span>
                      {a.zoneName && <span className="text-xs text-muted-foreground">· {a.zoneName}</span>}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{a.message}</p>
                    <div className="mt-1 text-[10px] text-muted-foreground">{timeAgo(a.createdAt)}</div>
                    {a.brief && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-[10px] text-primary hover:underline">View operational brief</summary>
                        <div className="mt-1 space-y-1.5 rounded-md border border-border bg-background/40 p-2 text-xs">
                          {(a.brief.sections ?? []).map((s: any, i: number) => (
                            <div key={i}><span className="font-semibold text-primary/80">{s.heading}: </span><span className="text-foreground/90">{s.body}</span></div>
                          ))}
                          {(a.brief.suggestedAlerts ?? []).length > 0 && (
                            <div className="border-t border-border pt-1">
                              <div className="text-[10px] text-muted-foreground">Suggested alerts:</div>
                              {a.brief.suggestedAlerts.map((m: string, i: number) => <div key={i} className="font-mono text-[10px] text-amber-200">{m}</div>)}
                            </div>
                          )}
                        </div>
                      </details>
                    )}
                  </div>
                  {!a.acknowledged && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => ack(a.id)}><Check className="h-3 w-3" />Ack</Button>}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
