"use client";

import { useAppStore, type LayerToggleState } from "@/lib/store/useAppStore";
import { HAZARD_LABELS, HAZARD_COLORS, type HazardType } from "@/lib/types";
import { hazardIcon } from "@/lib/map/icons";
import { cn } from "@/lib/utils";
import { Building2, Route, Crosshair, Users } from "lucide-react";
import { ProjectArtifactsPanel } from "./project-artifacts-panel";
import { CollapsibleSection } from "./collapsible-section";
import type { WatchZone } from "@/lib/types";

const HAZARD_LAYER_KEYS: { key: keyof LayerToggleState; hazard: HazardType }[] = [
  { key: "wildfire", hazard: "wildfire" },
  { key: "earthquake", hazard: "earthquake" },
  { key: "flood", hazard: "flood" },
  { key: "drought", hazard: "drought" },
  { key: "cyclone", hazard: "cyclone" },
  { key: "landslide", hazard: "landslide" },
  { key: "heat", hazard: "heat" },
  { key: "air_quality", hazard: "air_quality" },
];
const EXPOSURE_KEYS: { key: keyof LayerToggleState; label: string; icon: React.ElementType; color: string }[] = [
  { key: "osm_buildings", label: "Buildings", icon: Building2, color: "#64748b" },
  { key: "osm_roads", label: "Roads", icon: Route, color: "#334155" },
  { key: "critical_infra", label: "Critical infra", icon: Crosshair, color: "#38bdf8" },
  { key: "population", label: "Population", icon: Users, color: "#a78bfa" },
];

interface Props {
  onRegionSelect: (zone: WatchZone) => void;
  onRegionFlyTo: (poly: GeoJSON.Polygon) => void;
  onMarkerFlyTo: (point: GeoJSON.Point) => void;
  onArtifactsChanged?: () => void;
}

export function HazardLayerSidebar({ onRegionSelect, onRegionFlyTo, onMarkerFlyTo, onArtifactsChanged }: Props) {
  const { layers, toggleLayer, activeLayerId } = useAppStore();

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-card/50">
      <div className="scrollbar-thin flex-1 overflow-y-auto px-2 py-2 space-y-2">
        <CollapsibleSection
          id="hazard-feeds"
          title="Hazard feeds"
          hint="Live ingested events"
          count={HAZARD_LAYER_KEYS.filter(({ key }) => layers[key]).length}
        >
          {HAZARD_LAYER_KEYS.map(({ key, hazard }) => {
            const Icon = hazardIcon(hazard);
            return (
              <ToggleRow key={key} active={layers[key]} onClick={() => toggleLayer(key)} color={HAZARD_COLORS[hazard]}>
                <Icon className="h-3.5 w-3.5" style={{ color: HAZARD_COLORS[hazard] }} />
                <span>{HAZARD_LABELS[hazard]}</span>
              </ToggleRow>
            );
          })}
        </CollapsibleSection>

        <CollapsibleSection
          id="exposure-overlays"
          title="Exposure overlays"
          hint="After region analysis"
          count={EXPOSURE_KEYS.filter(({ key }) => layers[key]).length}
        >
          {EXPOSURE_KEYS.map(({ key, label, icon: Icon, color }) => (
            <ToggleRow key={key} active={layers[key]} onClick={() => toggleLayer(key)} color={color}>
              <Icon className="h-3.5 w-3.5" />
              <span>{label}</span>
            </ToggleRow>
          ))}
        </CollapsibleSection>

        <CollapsibleSection
          id="project-artifacts"
          title="Project artifacts"
          hint="Regions, markers, segments"
          defaultOpen
        >
          {activeLayerId && (
            <p className="mb-1 px-1 text-[10px] text-muted-foreground">
              Filtered by top-bar layer — switch to <span className="text-foreground">All</span> to see everything.
            </p>
          )}
          <ProjectArtifactsPanel
            onRegionSelect={onRegionSelect}
            onRegionFlyTo={onRegionFlyTo}
            onMarkerFlyTo={onMarkerFlyTo}
            onArtifactsChanged={onArtifactsChanged}
          />
        </CollapsibleSection>
      </div>
    </aside>
  );
}

function ToggleRow({ active, onClick, color, children }: { active: boolean; onClick: () => void; color: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-accent">
      <span className="relative flex h-3.5 w-3.5 items-center justify-center">
        <span className={cn("absolute inset-0 rounded-sm border", active ? "border-transparent" : "border-muted-foreground/40")} style={{ background: active ? color : "transparent" }} />
      </span>
      <span className={cn("flex items-center gap-1.5", active ? "text-foreground" : "text-muted-foreground")}>{children}</span>
    </button>
  );
}
