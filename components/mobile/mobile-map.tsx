"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { registerMapIcons } from "@/lib/map/icons";
import type { Peer } from "@/lib/realtime/use-presence";

export interface MobileMarker {
  id: string;
  geometry: GeoJSON.Point;
  label?: string | null;
  color: string;
  state: string;
  category: string;
}

interface Props {
  markers: MobileMarker[];
  peers?: Peer[];
  theme: "light" | "dark";
  addMode: boolean;
  pendingPoint?: [number, number] | null;
  center?: [number, number];
  zoom?: number;
  onMapTap: (lngLat: [number, number]) => void;
  onMarkerTap: (id: string) => void;
}

const CARTO: Record<"light" | "dark", string[]> = {
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

function toFeatures(markers: MobileMarker[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: markers.map((m) => ({
      type: "Feature",
      geometry: m.geometry,
      properties: { id: m.id, label: m.label ?? "", color: m.color, state: m.state, category: m.category },
    })),
  };
}

function toPeerFeatures(peers: Peer[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: peers.map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      properties: { name: p.name, color: p.color },
    })),
  };
}

export function MobileMap({ markers, peers = [], theme, addMode, pendingPoint, center = [10, 20], zoom = 2, onMapTap, onMarkerTap }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const addModeRef = useRef(addMode);
  addModeRef.current = addMode;
  const onMapTapRef = useRef(onMapTap);
  onMapTapRef.current = onMapTap;
  const onMarkerTapRef = useRef(onMarkerTap);
  onMarkerTapRef.current = onMarkerTap;

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
        sources: {
          base: { type: "raster", tiles: CARTO[theme], tileSize: 256, attribution: "© OpenStreetMap, © CARTO" },
        },
        layers: [{ id: "base", type: "raster", source: "base" }],
      },
      center,
      zoom,
      attributionControl: false,
    });
    mapRef.current = map;

    map.addControl(
      new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true, showUserLocation: true }),
      "bottom-right",
    );

    map.on("load", async () => {
      map.addSource("markers", { type: "geojson", data: toFeatures(markers) });
      map.addSource("pending", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("presence", { type: "geojson", data: toPeerFeatures(peers) });
      await registerMapIcons(map);

      map.addLayer({ id: "markers-glow", type: "circle", source: "markers", paint: {
        "circle-radius": 16, "circle-color": ["get", "color"], "circle-opacity": 0.3, "circle-blur": 0.6,
      } });
      map.addLayer({ id: "markers-circle", type: "circle", source: "markers", paint: {
        "circle-radius": 11, "circle-color": ["get", "color"], "circle-stroke-color": "#ffffff", "circle-stroke-width": 2.5,
      } });
      map.addLayer({ id: "markers-icon", type: "symbol", source: "markers", layout: {
        "icon-image": ["concat", "cat-", ["coalesce", ["get", "category"], "unknown"]],
        "icon-size": 0.9, "icon-allow-overlap": true, "icon-ignore-placement": true,
      } });

      map.addLayer({ id: "pending-glow", type: "circle", source: "pending", paint: {
        "circle-radius": 20, "circle-color": "#22d3ee", "circle-opacity": 0.35, "circle-blur": 0.5,
      } });
      map.addLayer({ id: "pending-pin", type: "circle", source: "pending", paint: {
        "circle-radius": 9, "circle-color": "#22d3ee", "circle-stroke-color": "#ffffff", "circle-stroke-width": 3,
      } });

      // live collaborators (presence)
      map.addLayer({ id: "presence-pulse", type: "circle", source: "presence", paint: {
        "circle-radius": 19, "circle-color": ["get", "color"], "circle-opacity": 0.22, "circle-blur": 0.6,
      } });
      map.addLayer({ id: "presence-dot", type: "circle", source: "presence", paint: {
        "circle-radius": 7, "circle-color": ["get", "color"], "circle-stroke-color": "#ffffff", "circle-stroke-width": 2.5,
      } });
      map.addLayer({ id: "presence-label", type: "symbol", source: "presence", layout: {
        "text-field": ["get", "name"], "text-size": 11, "text-offset": [0, -1.4], "text-anchor": "bottom", "text-max-width": 10,
      }, paint: { "text-color": ["get", "color"], "text-halo-color": "#0b1220", "text-halo-width": 1.5 } });

      readyRef.current = true;
      // The map is mounted behind a "ready" gate + dynamic import, so the GL
      // canvas can be created before the container has its final size. Force a
      // resize once everything is laid out so tiles actually render.
      map.resize();
    });

    map.on("click", (e) => {
      const hits = map.queryRenderedFeatures(e.point, { layers: ["markers-circle"] });
      const hit = hits[0];
      if (hit?.properties?.id) {
        onMarkerTapRef.current(String(hit.properties.id));
        return;
      }
      if (addModeRef.current) {
        onMapTapRef.current([e.lngLat.lng, e.lngLat.lat]);
      }
    });

    // Keep the GL canvas in sync with the container — guards against the map
    // being created (or revealed) while the container is still 0×0.
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      readyRef.current = false;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // marker data updates
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const src = map.getSource("markers") as maplibregl.GeoJSONSource | undefined;
    src?.setData(toFeatures(markers));
  }, [markers]);

  // presence updates
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const src = map.getSource("presence") as maplibregl.GeoJSONSource | undefined;
    src?.setData(toPeerFeatures(peers));
  }, [peers]);

  // pending point preview
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const src = map.getSource("pending") as maplibregl.GeoJSONSource | undefined;
    src?.setData({
      type: "FeatureCollection",
      features: pendingPoint
        ? [{ type: "Feature", geometry: { type: "Point", coordinates: pendingPoint }, properties: {} }]
        : [],
    });
  }, [pendingPoint]);

  // theme tiles
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource("base") as maplibregl.RasterTileSource | undefined;
    src?.setTiles(CARTO[theme]);
  }, [theme]);

  // cursor for add mode
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = addMode ? "crosshair" : "";
  }, [addMode]);

  return <div ref={containerRef} className="mobile-map absolute inset-0 h-full" />;
}
