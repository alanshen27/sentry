"use client";

import { cn } from "@/lib/utils";
import { LAYER_COLOR_OPTIONS } from "@/lib/layers/colors";

export function LayerColorPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-5 gap-1.5">
        {LAYER_COLOR_OPTIONS.map((c) => (
          <button
            key={c.id}
            type="button"
            title={c.label}
            onClick={() => onChange(c.value)}
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-md border p-1 transition-colors",
              value === c.value ? "border-primary bg-primary/10 ring-1 ring-primary/40" : "border-border hover:border-muted-foreground/50",
            )}
          >
            <span className="h-5 w-full rounded-sm" style={{ background: c.value }} />
            <span className="text-[8px] leading-none text-muted-foreground">{c.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
