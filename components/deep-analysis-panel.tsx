"use client";

import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2, Circle } from "lucide-react";

export function DeepAnalysisPanel({ steps, running }: { steps: { label: string; done: boolean }[]; running: boolean }) {
  if (!steps.length && !running) return null;
  const done = steps.filter((s) => s.done).length;
  const pct = steps.length ? (done / steps.length) * 100 : 0;
  return (
    <Card className="p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold">Deep Analysis</span>
        <span className="text-[10px] text-muted-foreground">{done}/{steps.length} steps</span>
      </div>
      <Progress value={pct} className="mb-2" />
      <div className="space-y-1">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            {s.done ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : running ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> : <Circle className="h-3.5 w-3.5 text-muted-foreground" />}
            <span className={cn(s.done ? "text-foreground" : "text-muted-foreground")}>{s.label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
