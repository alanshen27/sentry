"use client";

import { DEMO_REGIONS } from "@/lib/demo-regions";
import { useAppStore } from "@/lib/store/useAppStore";
import { cn } from "@/lib/utils";
import { MapPin } from "lucide-react";

export function DemoRegionSelector({ onSelect }: { onSelect: (id: string) => void }) {
  return (
    <div className="space-y-1">
      {DEMO_REGIONS.map((r) => (
        <button
          key={r.id}
          onClick={() => onSelect(r.id)}
          className="group flex w-full items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left text-xs transition-colors hover:border-border hover:bg-accent"
        >
          <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: r.accent }} />
          <div className="min-w-0">
            <div className="truncate font-medium">{r.name}</div>
            <div className="truncate text-[10px] text-muted-foreground">{r.description}</div>
          </div>
        </button>
      ))}
    </div>
  );
}
