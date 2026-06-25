"use client";

import { create } from "zustand";
import type { HazardType, FeedEvent, AnalysisResult, Sector } from "@/lib/types";
import type { OsmData } from "@/lib/sources/osm";

export interface LayerToggleState {
  wildfire: boolean; earthquake: boolean; flood: boolean; drought: boolean;
  cyclone: boolean; landslide: boolean; heat: boolean; air_quality: boolean;
  osm_buildings: boolean; osm_roads: boolean; critical_infra: boolean; population: boolean;
}

export interface MarkerDraft {
  id: string;
  geometry: GeoJSON.Point;
  label: string;
  color: string;
  state: string;
  category: string;
  sizeM2: number | null;
  notes: string | null;
  layerId?: string | null;
  source: string;
}

export interface ProjectLayerState {
  id: string;
  name: string;
  color: string;
  visible: boolean;
}

export interface AppStore {
  layers: LayerToggleState;
  toggleLayer: (k: keyof LayerToggleState) => void;
  setLayers: (l: Partial<LayerToggleState>) => void;

  drawMode: "none" | "polygon" | "marker" | "edit";
  setDrawMode: (m: AppStore["drawMode"]) => void;

  /** Open ring (no closing duplicate) while drawing or editing vertices. */
  vertexRing: number[][] | null;
  setVertexRing: (ring: number[][] | null) => void;

  updateSelectedGeometry: (g: GeoJSON.Polygon | null) => void;

  selectedGeometry: GeoJSON.Polygon | null;
  selectedZoneId: string | null;
  zoneName: string;
  setSelected: (g: GeoJSON.Polygon | null, name?: string, id?: string) => void;

  analysis: AnalysisResult | null;
  setAnalysis: (a: AnalysisResult | null) => void;
  analyzing: boolean;
  setAnalyzing: (b: boolean) => void;
  deepAnalysisSteps: { label: string; done: boolean }[];
  setDeepSteps: (s: { label: string; done: boolean }[]) => void;

  sectors: Sector[];
  setSectors: (s: Sector[]) => void;

  osmOverlay: OsmData | null;
  setOsmOverlay: (o: OsmData | null) => void;

  markers: MarkerDraft[];
  setMarkers: (m: MarkerDraft[]) => void;
  addMarker: (m: MarkerDraft) => void;
  updateMarker: (id: string, patch: Partial<MarkerDraft>) => void;
  removeMarker: (id: string) => void;

  activeWorkspaceId: string | null;
  activeProjectId: string | null;
  activeLayerId: string | null;
  setActive: (w?: string | null, p?: string | null, l?: string | null) => void;

  feed: FeedEvent[];
  pushFeed: (e: FeedEvent) => void;
  /** Convenience logger: builds a FeedEvent for any user/system action. */
  logAction: (message: string, opts?: { severity?: FeedEvent["severity"]; type?: FeedEvent["type"]; meta?: Record<string, any> }) => void;

  showMarkerPanel: boolean;
  setShowMarkerPanel: (b: boolean) => void;
  showTriggerBuilder: boolean;
  setShowTriggerBuilder: (b: boolean) => void;

  regionsNonce: number;
  bumpRegions: () => void;

  artifactsNonce: number;
  bumpArtifacts: () => void;

  layersNonce: number;
  bumpLayers: () => void;

  projectLayers: ProjectLayerState[];
  setProjectLayers: (layers: ProjectLayerState[]) => void;

  showMapFilters: boolean;
  setShowMapFilters: (show: boolean) => void;
}

const DEFAULT_LAYERS: LayerToggleState = {
  wildfire: true, earthquake: true, flood: true, drought: true,
  cyclone: true, landslide: false, heat: false, air_quality: false,
  osm_buildings: false, osm_roads: true, critical_infra: true, population: false,
};

export const useAppStore = create<AppStore>((set) => ({
  layers: DEFAULT_LAYERS,
  toggleLayer: (k) => set((s) => ({ layers: { ...s.layers, [k]: !s.layers[k] } })),
  setLayers: (l) => set((s) => ({ layers: { ...s.layers, ...l } })),

  drawMode: "none",
  setDrawMode: (m) => set({ drawMode: m }),

  vertexRing: null,
  setVertexRing: (ring) => set({ vertexRing: ring }),

  selectedGeometry: null,
  selectedZoneId: null,
  zoneName: "",
  setSelected: (g, name, id) => set((s) => {
    if (!g) {
      return {
        selectedGeometry: null,
        zoneName: "",
        selectedZoneId: null,
        analysis: null,
        sectors: [],
        osmOverlay: null,
        deepAnalysisSteps: [],
      };
    }
    const sameZone = id != null && id === s.selectedZoneId;
    return {
      selectedGeometry: g,
      zoneName: name ?? "",
      selectedZoneId: id ?? null,
      ...(sameZone ? {} : { analysis: null, sectors: [], osmOverlay: null, deepAnalysisSteps: [] }),
    };
  }),
  updateSelectedGeometry: (g) => set({ selectedGeometry: g }),

  analysis: null,
  setAnalysis: (a) => set({ analysis: a }),
  analyzing: false,
  setAnalyzing: (b) => set({ analyzing: b }),
  deepAnalysisSteps: [],
  setDeepSteps: (s) => set({ deepAnalysisSteps: s }),

  sectors: [],
  setSectors: (s) => set({ sectors: s }),

  osmOverlay: null,
  setOsmOverlay: (o) => set({ osmOverlay: o }),

  markers: [],
  setMarkers: (m) => set({ markers: m }),
  addMarker: (m) => set((s) => ({ markers: [...s.markers.filter((x) => x.id !== m.id), m] })),
  updateMarker: (id, patch) => set((s) => ({ markers: s.markers.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
  removeMarker: (id) => set((s) => ({ markers: s.markers.filter((x) => x.id !== id) })),

  activeWorkspaceId: null,
  activeProjectId: null,
  activeLayerId: null,
  setActive: (w, p, l) => set((s) => ({
    activeWorkspaceId: w !== undefined ? w : s.activeWorkspaceId,
    activeProjectId: p !== undefined ? p : s.activeProjectId,
    activeLayerId: l !== undefined ? l : s.activeLayerId,
  })),

  feed: [],
  pushFeed: (e) => set((s) => ({ feed: [e, ...s.feed].slice(0, 100) })),
  logAction: (message, opts) => set((s) => ({
    feed: [{
      id: Math.random().toString(36).slice(2),
      type: opts?.type ?? "system",
      message,
      severity: opts?.severity ?? "info",
      timestamp: new Date().toISOString(),
      meta: opts?.meta,
    }, ...s.feed].slice(0, 100),
  })),

  showMarkerPanel: false,
  setShowMarkerPanel: (b) => set({ showMarkerPanel: b }),
  showTriggerBuilder: false,
  setShowTriggerBuilder: (b) => set({ showTriggerBuilder: b }),

  regionsNonce: 0,
  bumpRegions: () => set((s) => ({ regionsNonce: s.regionsNonce + 1, artifactsNonce: s.artifactsNonce + 1 })),

  artifactsNonce: 0,
  bumpArtifacts: () => set((s) => ({ artifactsNonce: s.artifactsNonce + 1, regionsNonce: s.regionsNonce + 1 })),

  layersNonce: 0,
  bumpLayers: () => set((s) => ({ layersNonce: s.layersNonce + 1 })),

  projectLayers: [],
  setProjectLayers: (layers) => set({ projectLayers: layers }),

  showMapFilters: false,
  setShowMapFilters: (show) => set({ showMapFilters: show }),
}));
