"use client";

import { useEffect, useState } from "react";
import type { SourceStatus } from "@/lib/types";
import { cn, timeAgo } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, XCircle, KeyRound, ChevronDown } from "lucide-react";

type Variant = "full" | "compact" | "minimal";

export function DataSourceStatus({ variant = "full", hideInfra = false }: { variant?: Variant; hideInfra?: boolean }) {
  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [dbMode, setDbMode] = useState("");
  const [cacheMode, setCacheMode] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/status").then((r) => r.json()).then((d) => {
      setSources(d.sources ?? []);
      if (!hideInfra) {
        setDbMode(d.db ?? "");
        setCacheMode(d.cache ?? "");
      }
    }).catch(() => {});
  }, [hideInfra]);

  if (variant === "compact") {
    return (
      <div className="flex flex-wrap gap-1.5">
        {sources.map((s) => <StatusDot key={s.id} s={s} />)}
      </div>
    );
  }

  if (variant === "minimal") {
    const live = sources.filter((s) => s.state === "connected").length;
    const warn = sources.filter((s) => s.state === "cached_fallback" || s.state === "needs_api_key").length;
    const failed = sources.filter((s) => s.state === "failed").length;

    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-2 text-left text-[10px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="flex shrink-0 gap-0.5">
              {sources.slice(0, 7).map((s) => <StatusDot key={s.id} s={s} />)}
            </span>
            <span className="truncate">
              {live > 0 && <span className="text-emerald-500">{live} live</span>}
              {warn > 0 && <span className={live > 0 ? "ml-1 text-amber-500" : "text-amber-500"}>{warn} cached</span>}
              {failed > 0 && <span className="ml-1 text-red-400">{failed} down</span>}
              {sources.length === 0 && "Checking feeds…"}
            </span>
          </span>
          <ChevronDown className={cn("h-3 w-3 shrink-0 transition-transform", open && "rotate-180")} />
        </button>
        {open && (
          <div className="mt-2 space-y-1 border-t border-border/40 pt-2">
            {sources.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 text-[10px]">
                <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                  <StateIcon state={s.state} />
                  <span className="truncate">{s.name}</span>
                </span>
                <StateLabel state={s.state} />
              </div>
            ))}
            {(dbMode || cacheMode) && (
              <div className="flex gap-3 pt-1 text-[10px] text-muted-foreground">
                {dbMode && <span>DB <InfraBadge mode={dbMode} /></span>}
                {cacheMode && <span>Cache <InfraBadge mode={cacheMode} /></span>}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {sources.map((s) => <FullRow key={s.id} s={s} />)}
      {!hideInfra && (
        <>
          <div className="flex items-center justify-between border-t border-border pt-1.5 text-xs">
            <span className="text-muted-foreground">DB</span>
            <InfraBadge mode={dbMode} />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Cache</span>
            <InfraBadge mode={cacheMode} />
          </div>
        </>
      )}
    </div>
  );
}

function FullRow({ s }: { s: SourceStatus }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <StateIcon state={s.state} />
        {s.name}
      </span>
      <span className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground">{timeAgo(s.lastUpdated)}</span>
        <StateLabel state={s.state} />
      </span>
    </div>
  );
}

function StatusDot({ s }: { s: SourceStatus }) {
  const color =
    s.state === "connected" ? "bg-emerald-500"
    : s.state === "cached_fallback" ? "bg-amber-500"
    : s.state === "needs_api_key" ? "bg-slate-500"
    : "bg-red-500";
  return <span className={cn("h-1.5 w-1.5 rounded-full", color)} title={`${s.name}: ${s.state}`} />;
}

function StateIcon({ state }: { state: SourceStatus["state"] }) {
  if (state === "connected") return <CheckCircle2 className="h-3 w-3 text-emerald-500" />;
  if (state === "cached_fallback") return <AlertTriangle className="h-3 w-3 text-amber-500" />;
  if (state === "needs_api_key") return <KeyRound className="h-3 w-3 text-slate-500" />;
  return <XCircle className="h-3 w-3 text-red-500" />;
}

function StateLabel({ state }: { state: SourceStatus["state"] }) {
  const cls = state === "connected" ? "text-emerald-400" : state === "cached_fallback" ? "text-amber-400" : state === "needs_api_key" ? "text-slate-400" : "text-red-400";
  const txt = state === "connected" ? "live" : state === "cached_fallback" ? "cached" : state === "needs_api_key" ? "needs key" : "failed";
  return <span className={cn("shrink-0 text-[10px] font-medium", cls)}>{txt}</span>;
}

function InfraBadge({ mode }: { mode: string }) {
  const cls = mode === "prisma" || mode === "redis" ? "text-emerald-400" : "text-amber-400";
  return <span className={cn("text-[10px] font-medium", cls)}>{mode || "—"}</span>;
}
