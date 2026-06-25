"use client";

import { useState } from "react";
import type { BriefResult } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toaster";
import { Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

function BriefBody({ brief, className }: { brief: BriefResult; className?: string }) {
  return (
    <div className={cn("text-xs leading-relaxed", className)}>
      {brief.sections.map((s, i) => (
        <div key={i} className="mb-3 last:mb-0">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-primary/80">{s.heading}</div>
          <div className="text-foreground/90 whitespace-pre-wrap">{s.body}</div>
        </div>
      ))}
      {brief.suggestedAlerts.length > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          <div className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Suggested alerts</div>
          <div className="space-y-1">
            {brief.suggestedAlerts.map((a, i) => (
              <div key={i} className="rounded border border-border bg-background/40 px-2 py-1 font-mono text-[10px] text-amber-200">{a}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function LLMBriefCard({ brief, loading }: { brief: BriefResult | null; loading?: boolean }) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  if (loading) {
    return (
      <Card className="p-3">
        <div className="mb-2 text-xs font-medium text-muted-foreground">Generating operational brief…</div>
        <div className="space-y-1.5">{[...Array(4)].map((_, i) => <div key={i} className="h-2.5 w-full animate-pulse rounded bg-secondary" style={{ width: `${90 - i * 12}%` }} />)}</div>
      </Card>
    );
  }
  if (!brief) return <div className="px-1 text-xs text-muted-foreground">No brief generated yet.</div>;

  const actions = (
    <div className="flex items-center gap-1.5">
      <Badge variant="outline" className="text-[9px]">{brief.provider === "computed" ? "computed" : brief.provider}</Badge>
      <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => { navigator.clipboard.writeText(brief.text); toast({ title: "Brief copied", variant: "success" }); }}>Copy</Button>
      <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => download(brief)}>Download</Button>
      <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => setExpanded(true)}>
        <Maximize2 className="h-3 w-3" />Expand
      </Button>
    </div>
  );

  return (
    <>
      <Card className="p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-xs font-semibold">Analysis Report</div>
          {actions}
        </div>
        <div className="scrollbar-thin max-h-[280px] overflow-y-auto pr-1">
          <BriefBody brief={brief} />
        </div>
      </Card>

      <Dialog open={expanded} onOpenChange={(o) => { setExpanded(o); if (!o) setFullscreen(false); }}>
        <DialogContent
          className={cn(
            "flex flex-col gap-0 p-0",
            fullscreen
              ? "fixed inset-2 max-h-none max-w-none translate-x-0 translate-y-0 left-0 top-0 h-[calc(100vh-1rem)] w-[calc(100vw-1rem)] rounded-lg"
              : "max-h-[85vh] max-w-2xl",
          )}
        >
          <DialogHeader className="shrink-0 border-b border-border px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <DialogTitle className="text-sm">Analysis Report</DialogTitle>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => setFullscreen((f) => !f)}>
                  {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                  {fullscreen ? "Exit full screen" : "Full screen"}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => { navigator.clipboard.writeText(brief.text); toast({ title: "Brief copied", variant: "success" }); }}>Copy</Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => download(brief)}>Download</Button>
              </div>
            </div>
          </DialogHeader>
          <div className="scrollbar-thin flex-1 overflow-y-auto px-4 py-3">
            <BriefBody brief={brief} className="text-sm leading-relaxed" />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function download(brief: BriefResult) {
  const blob = new Blob([brief.text + "\n\n---\nGenerated " + brief.generatedAt + " via " + brief.provider], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `sentry-brief-${Date.now()}.txt`; a.click();
  URL.revokeObjectURL(url);
}
