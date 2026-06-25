"use client";

import type { ExposedAssets } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

export function ExposurePanel({ assets }: { assets: ExposedAssets | null }) {
  if (!assets) return <div className="px-1 text-xs text-muted-foreground">Run an analysis to compute exposure.</div>;
  const items = [
    { label: "Buildings", value: formatNumber(assets.buildings) },
    { label: "Roads", value: `${assets.roadLengthKm} km` },
    { label: "Population (est.)", value: formatNumber(assets.populationEstimate) },
    { label: "Schools", value: assets.schools },
    { label: "Hospitals", value: assets.hospitals },
    { label: "Clinics", value: assets.clinics },
    { label: "Shelters", value: assets.shelters },
    { label: "Critical", value: assets.criticalFacilities.length },
  ];
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {items.map((it) => (
        <div key={it.label} className="rounded-md border border-border bg-background/40 px-2 py-1.5">
          <div className="text-[10px] text-muted-foreground">{it.label}</div>
          <div className="text-sm font-semibold tabular-nums">{it.value}</div>
        </div>
      ))}
    </div>
  );
}

export function CriticalAssetsTable({ assets }: { assets: ExposedAssets | null }) {
  if (!assets || !assets.criticalFacilities.length) return <div className="px-1 text-xs text-muted-foreground">No critical facilities mapped in zone.</div>;
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <table className="w-full text-xs">
        <thead className="bg-secondary/50 text-[10px] uppercase tracking-wider text-muted-foreground">
          <tr><th className="px-2 py-1 text-left">Name</th><th className="px-2 py-1 text-left">Type</th></tr>
        </thead>
        <tbody>
          {assets.criticalFacilities.map((f) => (
            <tr key={f.id} className="border-t border-border">
              <td className="px-2 py-1">{f.name}</td>
              <td className="px-2 py-1"><span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">{f.type}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
