"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { PenLine } from "lucide-react";
import { ProjectArtifactsPanel } from "./project-artifacts-panel";
import { useAppStore } from "@/lib/store/useAppStore";
import type { WatchZone } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRegionSelect: (zone: WatchZone) => void;
  onDrawRegion: () => void;
}

export function AnalyzeRegionDialog({ open, onOpenChange, onRegionSelect, onDrawRegion }: Props) {
  const { activeProjectId } = useAppStore();

  function pickRegion(zone: WatchZone) {
    onRegionSelect(zone);
    onOpenChange(false);
  }

  function startDraw() {
    onDrawRegion();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Where do you want to analyze?</DialogTitle>
          <DialogDescription>
            Pick a saved region or draw a new area on the map. Analysis computes risk, exposure, and an operational brief.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Saved regions</div>
            <div className="max-h-52 overflow-y-auto rounded-md border border-border bg-muted/20 p-1">
              {activeProjectId ? (
                <ProjectArtifactsPanel
                  compact
                  onRegionSelect={(z) => pickRegion(z)}
                  onRegionFlyTo={() => {}}
                />
              ) : (
                <p className="px-2 py-3 text-xs text-muted-foreground">Select a project first to load saved regions.</p>
              )}
            </div>
          </div>

          <button
            onClick={startDraw}
            className="flex w-full items-center gap-2 rounded-md border border-dashed border-border px-3 py-3 text-left text-xs transition-colors hover:border-cyan-500/40 hover:bg-cyan-500/5"
          >
            <PenLine className="h-4 w-4 shrink-0 text-cyan-400" />
            <div>
              <div className="font-medium">Draw new region</div>
              <div className="text-[10px] text-muted-foreground">Click vertices · snap to first point to close · drag to adjust</div>
            </div>
          </button>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
