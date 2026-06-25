"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function CollapsibleSection({
  id,
  title,
  hint,
  count,
  defaultOpen,
  children,
  className,
}: {
  id: string;
  title: string;
  hint?: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const storageKey = `sentry-section-open-${id}`;
  const [open, setOpen] = useState(defaultOpen ?? false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null) setOpen(stored === "true");
      else if (defaultOpen !== undefined) setOpen(defaultOpen);
    } catch { /* ignore */ }
  }, [storageKey, defaultOpen]);

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      try { localStorage.setItem(storageKey, String(next)); } catch { /* ignore */ }
      return next;
    });
  }

  return (
    <div className={cn("rounded-md border border-border/60 bg-muted/10", className)}>
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left transition-colors hover:bg-accent/40"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
          {!open && hint && <div className="truncate text-[9px] text-muted-foreground/70">{hint}</div>}
        </div>
        {count !== undefined && (
          <span className={cn(
            "rounded-full px-1.5 py-0.5 text-[9px] tabular-nums",
            count > 0 ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
          )}>
            {count}
          </span>
        )}
      </button>
      {open && <div className="space-y-0.5 border-t border-border/40 px-1 py-1">{children}</div>}
    </div>
  );
}
