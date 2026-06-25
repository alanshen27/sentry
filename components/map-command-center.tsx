"use client";

import { useEffect, useRef, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { HazardEvent, HazardType } from "@/lib/types";
import { HAZARD_COLORS, HAZARD_LABELS } from "@/lib/types";
import { useAppStore, type MarkerDraft } from "@/lib/store/useAppStore";
import { filterEventsByLayers } from "@/lib/layers";
import { closedPolygon, openRing, snapCoord, snapVertexIndex, type LngLat } from "@/lib/polygon-edit";
import { buildMarkerLabel } from "@/lib/markers/label";
import { registerMapIcons, hazardIconSvg, markerCategoryIconSvg } from "@/lib/map/icons";
import { markerCategoryLabel, MARKER_STATE_LABELS } from "@/lib/markers/constants";
import type { Peer } from "@/lib/realtime/use-presence";
import { uid } from "@/lib/utils";

interface Props {
  events: HazardEvent[];
  serverMarkers?: any[];
  localMarkers?: MarkerDraft[];
  peers?: Peer[];
  buildings?: GeoJSON.FeatureCollection;
  roads?: GeoJSON.FeatureCollection;
  facilities?: GeoJSON.FeatureCollection;
  initialCenter?: [number, number];
  initialZoom?: number;
  theme?: "light" | "dark";
  basemap?: BasemapStyle;
  flyTarget?: { polygon: GeoJSON.Polygon; nonce: number } | null;
  markerFlyTarget?: { point: GeoJSON.Point; nonce: number } | null;
  onPolygonComplete: (poly: GeoJSON.Polygon) => void;
  onMarkerComplete: (m: MarkerDraft) => void;
  onZoneGeometrySaved?: (zoneId: string, geometry: GeoJSON.Polygon) => void;
}

const RISK_FILL = [
  "step", ["get", "risk"],
  "rgba(34,197,94,0.10)", 26,
  "rgba(234,179,8,0.18)", 51,
  "rgba(249,115,22,0.28)", 76,
  "rgba(239,68,68,0.40)",
];

const SNAP_PX = 14;

const BASEMAP_TILES: Record<"light" | "dark", string[]> = {
  dark: [
    "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
    "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
    "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
  ],
  light: [
    "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
    "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
    "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
  ],
};

const SATELLITE_TILES = [
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
];

export type BasemapStyle = "map" | "satellite";

function tilesFor(basemap: BasemapStyle, theme: "light" | "dark"): string[] {
  return basemap === "satellite" ? SATELLITE_TILES : BASEMAP_TILES[theme];
}

export function MapCommandCenter({
  events, serverMarkers, localMarkers, peers, buildings, roads, facilities,
  initialCenter = [42, 2], initialZoom = 4.5, theme = "dark", basemap = "map",
  flyTarget, markerFlyTarget, onPolygonComplete, onMarkerComplete, onZoneGeometrySaved,
}: Props) {
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const basemapRef = useRef(basemap);
  basemapRef.current = basemap;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const dragRef = useRef<{ index: number } | null>(null);
  const cursorRef = useRef<string>("");
  const {
    layers, drawMode, vertexRing, setVertexRing, selectedGeometry, selectedZoneId,
    sectors, setDrawMode, updateSelectedGeometry, pushFeed, activeLayerId,
  } = useAppStore();

  const project = useCallback((map: maplibregl.Map, lngLat: LngLat) => map.project(lngLat), []);

  const syncRingToMap = useCallback((map: maplibregl.Map, ring: number[][]) => {
    const src = map.getSource("draw-ring") as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    const feats: GeoJSON.Feature[] = [];
    if (ring.length) {
      feats.push({ type: "Feature", geometry: { type: "LineString", coordinates: ring }, properties: { kind: "line" } });
      if (ring.length >= 3) {
        feats.push({ type: "Feature", geometry: { type: "Polygon", coordinates: [[...ring, ring[0]]] }, properties: { kind: "preview" } });
      }
      ring.forEach((c, i) => feats.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: c },
        properties: { kind: "vertex", index: i, isFirst: i === 0, canClose: i === 0 && ring.length >= 3 },
      }));
    }
    src.setData({ type: "FeatureCollection", features: feats });
  }, []);

  const persistZoneGeometry = useCallback(async (zoneId: string, geometry: GeoJSON.Polygon) => {
    const r = await fetch(`/api/zones/${zoneId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ geometry }),
    });
    if (r.ok) onZoneGeometrySaved?.(zoneId, geometry);
  }, [onZoneGeometrySaved]);

  const finishDraw = useCallback((ring: number[][]) => {
    if (ring.length < 3) return;
    const poly = closedPolygon(ring);
    setVertexRing(null);
    setDrawMode("none");
    onPolygonComplete(poly);
  }, [onPolygonComplete, setDrawMode, setVertexRing]);

  // init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          basemap: { type: "raster", tiles: tilesFor(basemapRef.current, themeRef.current), tileSize: 256, attribution: "© OpenStreetMap © CARTO · Imagery © Esri" },
        },
        layers: [{ id: "basemap", type: "raster", source: "basemap", paint: { "raster-opacity": basemapRef.current === "satellite" ? 1 : 0.92 } }],
        glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
      },
      center: initialCenter, zoom: initialZoom,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
    map.on("load", async () => {
      map.addSource("events", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("selected", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("sectors", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("buildings", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("roads", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("facilities", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("markers", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("presence", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("draw-ring", { type: "geojson", data: { type: "FeatureCollection", features: [] } });

      await registerMapIcons(map);

      map.addLayer({ id: "buildings-fill", type: "fill", source: "buildings", paint: { "fill-color": "#475569", "fill-opacity": 0.25 }, layout: { visibility: "none" } });
      map.addLayer({ id: "buildings-line", type: "line", source: "buildings", paint: { "line-color": "#64748b", "line-width": 0.5 }, layout: { visibility: "none" } });
      map.addLayer({ id: "roads-line", type: "line", source: "roads", paint: { "line-color": "#334155", "line-width": 1 } as any, layout: { visibility: "none" } });
      map.addLayer({ id: "facilities-circle", type: "circle", source: "facilities", paint: { "circle-radius": 4, "circle-color": "#38bdf8", "circle-stroke-color": "#0b1220", "circle-stroke-width": 1 }, layout: { visibility: "none" } });
      map.addLayer({ id: "sectors-fill", type: "fill", source: "sectors", paint: { "fill-color": RISK_FILL as any }, layout: { visibility: "none" } });
      map.addLayer({ id: "sectors-line", type: "line", source: "sectors", paint: { "line-color": "#1e293b", "line-width": 0.5 }, layout: { visibility: "none" } });
      map.addLayer({ id: "selected-fill", type: "fill", source: "selected", paint: { "fill-color": "#22d3ee", "fill-opacity": 0.18 } });
      map.addLayer({ id: "selected-glow", type: "line", source: "selected", paint: { "line-color": "#22d3ee", "line-width": 8, "line-opacity": 0.25, "line-blur": 4 } });
      map.addLayer({ id: "selected-line", type: "line", source: "selected", paint: { "line-color": "#67e8f9", "line-width": 3 } });
      map.addLayer({ id: "events-glow", type: "circle", source: "events", paint: {
        "circle-radius": ["interpolate", ["linear"], ["get", "severity"], 0, 6, 100, 16],
        "circle-color": ["get", "color"], "circle-opacity": 0.18, "circle-blur": 0.6,
      } });
      map.addLayer({ id: "events-icon", type: "symbol", source: "events", layout: {
        "icon-image": ["concat", "haz-", ["coalesce", ["get", "type"], "unknown"]],
        "icon-size": ["interpolate", ["linear"], ["get", "severity"], 0, 0.55, 100, 1.0],
        "icon-allow-overlap": true, "icon-ignore-placement": true,
      } });
      map.addLayer({ id: "markers-glow", type: "circle", source: "markers", paint: {
        "circle-radius": 14, "circle-color": ["get", "color"], "circle-opacity": 0.35, "circle-blur": 0.6,
      } });
      map.addLayer({ id: "markers-circle", type: "circle", source: "markers", paint: {
        "circle-radius": 9, "circle-color": ["get", "color"], "circle-stroke-color": "#ffffff", "circle-stroke-width": 2.5, "circle-opacity": 1,
      } });
      map.addLayer({ id: "markers-icon", type: "symbol", source: "markers", layout: {
        "icon-image": ["concat", "cat-", ["coalesce", ["get", "category"], "unknown"]],
        "icon-size": 0.85, "icon-allow-overlap": true, "icon-ignore-placement": true,
      } });
      map.addLayer({ id: "markers-label", type: "symbol", source: "markers", layout: {
        "text-field": ["get", "label"], "text-size": 11, "text-offset": [0, 1.7], "text-anchor": "top", "text-max-width": 10,
      }, paint: { "text-color": "#f8fafc", "text-halo-color": "#0b1220", "text-halo-width": 1.5 } });
      map.addLayer({ id: "presence-pulse", type: "circle", source: "presence", paint: {
        "circle-radius": 18, "circle-color": ["get", "color"], "circle-opacity": 0.22, "circle-blur": 0.6,
      } });
      map.addLayer({ id: "presence-dot", type: "circle", source: "presence", paint: {
        "circle-radius": 6.5, "circle-color": ["get", "color"], "circle-stroke-color": "#ffffff", "circle-stroke-width": 2.5,
      } });
      map.addLayer({ id: "presence-label", type: "symbol", source: "presence", layout: {
        "text-field": ["get", "name"], "text-size": 11, "text-offset": [0, -1.4], "text-anchor": "bottom", "text-max-width": 10,
      }, paint: { "text-color": ["get", "color"], "text-halo-color": "#0b1220", "text-halo-width": 1.5 } });
      map.addLayer({ id: "draw-ring-fill", type: "fill", source: "draw-ring", filter: ["==", ["get", "kind"], "preview"], paint: { "fill-color": "#fb923c", "fill-opacity": 0.12 } });
      map.addLayer({ id: "draw-ring-line", type: "line", source: "draw-ring", filter: ["==", ["get", "kind"], "line"], paint: { "line-color": "#fb923c", "line-width": 3, "line-dasharray": [2, 1] } });
      map.addLayer({ id: "draw-ring-pt-glow", type: "circle", source: "draw-ring", filter: ["==", ["get", "kind"], "vertex"], paint: {
        "circle-radius": ["case", ["get", "canClose"], 14, 10],
        "circle-color": ["case", ["get", "canClose"], "#22d3ee", "#fb923c"],
        "circle-opacity": 0.35, "circle-blur": 0.5,
      } });
      map.addLayer({ id: "draw-ring-pt", type: "circle", source: "draw-ring", filter: ["==", ["get", "kind"], "vertex"], paint: {
        "circle-radius": ["case", ["get", "canClose"], 8, 6],
        "circle-color": ["case", ["get", "canClose"], "#22d3ee", "#fb923c"],
        "circle-stroke-color": "#ffffff", "circle-stroke-width": 2,
      } });

      const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: true, offset: 12 });
      map.on("mouseenter", "events-icon", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "events-icon", () => { map.getCanvas().style.cursor = cursorRef.current; });
      map.on("click", "events-icon", (e: any) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties;
        const label = HAZARD_LABELS[p.type as HazardType] ?? p.type;
        const color = HAZARD_COLORS[p.type as HazardType] ?? "#f97316";
        popup.setLngLat(e.lngLat).setHTML(
          `<div style="font-size:12px;line-height:1.45">` +
          `<div style="display:flex;align-items:center;gap:6px;font-weight:600;font-size:13px">${hazardIconSvg(p.type, color, 15)}<span>${label}</span></div>` +
          `<div style="color:#94a3b8">Severity <b style="color:#e2e8f0">${p.severity}/100</b></div>` +
          `<div style="color:#94a3b8">Source ${p.source}</div>` +
          `</div>`,
        ).addTo(map);
      });
      map.on("mouseenter", "markers-circle", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "markers-circle", () => { map.getCanvas().style.cursor = cursorRef.current; });
      map.on("click", "markers-circle", (e: any) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties;
        const stateLabel = MARKER_STATE_LABELS[p.state as keyof typeof MARKER_STATE_LABELS] ?? p.state;
        popup.setLngLat(e.lngLat).setHTML(
          `<div style="font-size:12px;line-height:1.45">` +
          `<div style="display:flex;align-items:center;gap:6px;font-weight:600;font-size:13px">${markerCategoryIconSvg(p.category, p.color ?? "#e2e8f0", 15)}<span>${p.label ?? "Marker"}</span></div>` +
          `<div style="color:#94a3b8">${markerCategoryLabel(p.category)} · <b style="color:#e2e8f0">${stateLabel}</b></div>` +
          `</div>`,
        ).addTo(map);
      });
    });
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // vertex ring → map layer + live selected geometry while editing
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource("draw-ring")) return;
    const ring = vertexRing ?? [];
    syncRingToMap(map, ring);
    if (ring.length >= 3 && (drawMode === "edit" || drawMode === "polygon")) {
      try {
        const poly = closedPolygon(ring);
        updateSelectedGeometry(poly);
      } catch { /* incomplete */ }
    }
  }, [vertexRing, drawMode, syncRingToMap, updateSelectedGeometry]);

  // draw / edit interactions
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const proj = (ll: LngLat) => project(map, ll);

    const onClick = (e: maplibregl.MapMouseEvent) => {
      const mode = useAppStore.getState().drawMode;
      if (mode === "marker") {
        const lng = e.lngLat.lng;
        const lat = e.lngLat.lat;
        onMarkerComplete({
          id: uid("mk"), geometry: { type: "Point", coordinates: [lng, lat] },
          label: buildMarkerLabel("observation", {}, lng, lat),
          color: "#fbbf24", state: "pending", category: "observation",
          sizeM2: null, notes: null, source: "user", layerId: activeLayerId ?? null,
        });
        setDrawMode("none");
        return;
      }
      if (mode !== "polygon") return;

      const ring = [...(useAppStore.getState().vertexRing ?? [])];
      const pt: LngLat = [e.lngLat.lng, e.lngLat.lat];
      const snapIdx = snapVertexIndex(proj, pt, ring as LngLat[], SNAP_PX);

      if (snapIdx === 0 && ring.length >= 3) {
        finishDraw(ring);
        return;
      }
      if (snapIdx >= 0) return;

      const snapped = snapCoord(proj, pt, ring as LngLat[], SNAP_PX) ?? pt;
      setVertexRing([...ring, snapped]);
    };

    const onMouseDown = (e: maplibregl.MapMouseEvent) => {
      const mode = useAppStore.getState().drawMode;
      if (mode !== "polygon" && mode !== "edit") return;
      const feats = map.queryRenderedFeatures(e.point, { layers: ["draw-ring-pt"] });
      const f = feats[0];
      if (!f || f.properties?.kind !== "vertex") return;
      dragRef.current = { index: f.properties.index as number };
      map.dragPan.disable();
      e.preventDefault();
    };

    const onMouseMove = (e: maplibregl.MapMouseEvent) => {
      const mode = useAppStore.getState().drawMode;
      if (dragRef.current) {
        const ring = [...(useAppStore.getState().vertexRing ?? [])];
        const idx = dragRef.current.index;
        let pt: LngLat = [e.lngLat.lng, e.lngLat.lat];
        const others = ring.filter((_, i) => i !== idx) as LngLat[];
        const snapped = snapCoord(proj, pt, others, SNAP_PX);
        if (snapped) pt = snapped;
        ring[idx] = pt;
        setVertexRing(ring);
        map.getCanvas().style.cursor = "grabbing";
        return;
      }
      if (mode === "polygon" || mode === "edit") {
        const feats = map.queryRenderedFeatures(e.point, { layers: ["draw-ring-pt"] });
        map.getCanvas().style.cursor = feats.length ? "grab" : (mode === "polygon" ? "crosshair" : "default");
        cursorRef.current = map.getCanvas().style.cursor;
      }
    };

    const onMouseUp = () => {
      if (!dragRef.current) return;
      const mode = useAppStore.getState().drawMode;
      const zoneId = useAppStore.getState().selectedZoneId;
      const ring = useAppStore.getState().vertexRing;
      dragRef.current = null;
      map.dragPan.enable();
      if (mode === "edit" && zoneId && ring && ring.length >= 3) {
        try {
          const poly = closedPolygon(ring);
          persistZoneGeometry(zoneId, poly);
          pushFeed({ id: uid("feed"), type: "system", message: "Region shape saved", severity: "info", timestamp: new Date().toISOString() });
        } catch { /* ignore */ }
      }
      const modeNow = useAppStore.getState().drawMode;
      map.getCanvas().style.cursor = modeNow === "polygon" ? "crosshair" : "";
      cursorRef.current = map.getCanvas().style.cursor;
    };

    const onKey = (e: KeyboardEvent) => {
      const mode = useAppStore.getState().drawMode;
      const ring = useAppStore.getState().vertexRing ?? [];
      if (e.key === "Escape") {
        if (mode === "polygon") { setVertexRing(null); setDrawMode("none"); }
        else if (mode === "edit") {
          const sel = useAppStore.getState().selectedGeometry;
          if (sel) setVertexRing(openRing(sel));
          setDrawMode("none");
        }
      }
      if (e.key === "Enter" && mode === "polygon" && ring.length >= 3) finishDraw(ring);
      if (e.key === "Enter" && mode === "edit") setDrawMode("none");
    };

    map.on("click", onClick);
    map.on("mousedown", onMouseDown);
    map.on("mousemove", onMouseMove);
    map.on("mouseup", onMouseUp);
    window.addEventListener("keydown", onKey);
    map.doubleClickZoom[drawMode === "polygon" ? "disable" : "enable"]();
    cursorRef.current = drawMode === "polygon" ? "crosshair" : drawMode === "edit" ? "default" : "";
    map.getCanvas().style.cursor = cursorRef.current;

    return () => {
      map.off("click", onClick);
      map.off("mousedown", onMouseDown);
      map.off("mousemove", onMouseMove);
      map.off("mouseup", onMouseUp);
      window.removeEventListener("keydown", onKey);
      map.dragPan.enable();
    };
  }, [drawMode, finishDraw, onMarkerComplete, persistZoneGeometry, project, pushFeed, setDrawMode, setVertexRing, activeLayerId]);

  // clear draw layer when not drawing/editing
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource("draw-ring")) return;
    if (drawMode !== "polygon" && drawMode !== "edit") {
      syncRingToMap(map, []);
    }
  }, [drawMode, syncRingToMap]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource("events")) return;
    const visible = filterEventsByLayers(events, layers);
    const feats = visible.map((e) => ({
      type: "Feature" as const, geometry: e.geometry,
      properties: { type: e.type, source: e.source, severity: e.severity, confidence: e.confidence, color: HAZARD_COLORS[e.type] ?? "#f97316", extra: "" },
    }));
    (map.getSource("events") as maplibregl.GeoJSONSource).setData({ type: "FeatureCollection", features: feats });
  }, [events, layers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource("selected")) return;
    const showSelected = drawMode !== "polygon" && drawMode !== "edit";
    const feats = showSelected && selectedGeometry ? [{ type: "Feature" as const, geometry: selectedGeometry, properties: {} }] : [];
    (map.getSource("selected") as maplibregl.GeoJSONSource).setData({ type: "FeatureCollection", features: feats });
  }, [selectedGeometry, drawMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource("sectors")) return;
    const feats = sectors.map((s) => ({ type: "Feature" as const, geometry: s.geometry, properties: { risk: s.overallRisk, id: s.id } }));
    (map.getSource("sectors") as maplibregl.GeoJSONSource).setData({ type: "FeatureCollection", features: feats });
  }, [sectors]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource("markers")) return;
    const toFeat = (m: any) => ({ type: "Feature" as const, geometry: m.geometry, properties: { id: m.id, label: m.label, color: m.color, state: m.state, category: m.category, source: m.source } });
    const all = [...(localMarkers ?? []), ...(serverMarkers ?? [])];
    (map.getSource("markers") as maplibregl.GeoJSONSource).setData({ type: "FeatureCollection", features: all.map(toFeat) });
  }, [localMarkers, serverMarkers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource("presence")) return;
    (map.getSource("presence") as maplibregl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features: (peers ?? []).map((p) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
        properties: { name: p.name, color: p.color },
      })),
    });
  }, [peers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !markerFlyTarget) return;
    map.flyTo({ center: markerFlyTarget.point.coordinates as [number, number], zoom: Math.max(map.getZoom(), 12), duration: 800 });
  }, [markerFlyTarget]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource("buildings")) return;
    (map.getSource("buildings") as maplibregl.GeoJSONSource).setData(buildings ?? { type: "FeatureCollection", features: [] });
  }, [buildings]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource("roads")) return;
    const data = roads ? { type: "FeatureCollection" as const, features: roads.features } : { type: "FeatureCollection" as const, features: [] };
    (map.getSource("roads") as maplibregl.GeoJSONSource).setData(data);
  }, [roads]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource("facilities")) return;
    (map.getSource("facilities") as maplibregl.GeoJSONSource).setData(facilities ?? { type: "FeatureCollection", features: [] });
  }, [facilities]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const setVis = (id: string, on: boolean) => { if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", on ? "visible" : "none"); };
    setVis("buildings-fill", layers.osm_buildings);
    setVis("buildings-line", layers.osm_buildings);
    setVis("roads-line", layers.osm_roads);
    setVis("facilities-circle", layers.critical_infra);
    setVis("sectors-fill", sectors.length > 0);
    setVis("sectors-line", sectors.length > 0);
  }, [layers, sectors.length]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource("basemap") as maplibregl.RasterTileSource | undefined;
    if (src && typeof src.setTiles === "function") src.setTiles(tilesFor(basemap, theme));
    if (map.getLayer("basemap")) map.setPaintProperty("basemap", "raster-opacity", basemap === "satellite" ? 1 : 0.92);
  }, [theme, basemap]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTarget) return;
    const ring = flyTarget.polygon.coordinates[0];
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    for (const [lng, lat] of ring) { minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng); minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat); }
    map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 60, duration: 900 });
  }, [flyTarget]);

  return <div ref={containerRef} className="absolute inset-0 h-full w-full" />;
}

export function flyToPolygon(map: maplibregl.Map | null, poly: GeoJSON.Polygon) {
  if (!map) return;
  const ring = poly.coordinates[0];
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const [lng, lat] of ring) {
    minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
  }
  map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 60, duration: 900 });
}
