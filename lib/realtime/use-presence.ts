"use client";

import { useEffect, useRef, useState } from "react";

export interface Peer {
  userId: string;
  name: string;
  color: string;
  lng: number;
  lat: number;
  accuracy?: number | null;
  device?: "mobile" | "desktop";
  at: string;
}

const STALE_MS = 45_000;
const MIN_POST_INTERVAL_MS = 4_000;
const HEARTBEAT_MS = 20_000;

interface Options {
  projectId: string | null;
  selfId: string | null;
  /** When true, watch the device location and broadcast it to the room. */
  share?: boolean;
  device?: "mobile" | "desktop";
}

interface Result {
  peers: Peer[];
  connected: boolean;
  geoError: string | null;
}

/** Subscribes to a project's live presence and (optionally) shares own location. */
export function usePresence({ projectId, selfId, share = false, device = "desktop" }: Options): Result {
  const [peersMap, setPeersMap] = useState<Record<string, Peer>>({});
  const [connected, setConnected] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // ---- subscribe to the stream ----
  useEffect(() => {
    if (!projectId) return;
    setPeersMap({});
    const es = new EventSource(`/api/presence/stream?projectId=${encodeURIComponent(projectId)}`);

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (ev) => {
      let msg: any;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.type === "snapshot") {
        const next: Record<string, Peer> = {};
        for (const p of msg.presence as Peer[]) next[p.userId] = p;
        setPeersMap(next);
      } else if (msg.type === "update") {
        const p = msg.presence as Peer;
        setPeersMap((prev) => ({ ...prev, [p.userId]: p }));
      } else if (msg.type === "leave") {
        setPeersMap((prev) => {
          const next = { ...prev };
          delete next[msg.userId];
          return next;
        });
      }
    };

    return () => { es.close(); setConnected(false); };
  }, [projectId]);

  // ---- prune stale peers ----
  useEffect(() => {
    const t = setInterval(() => {
      const cutoff = Date.now() - STALE_MS;
      setPeersMap((prev) => {
        let changed = false;
        const next: Record<string, Peer> = {};
        for (const [id, p] of Object.entries(prev)) {
          if (new Date(p.at).getTime() >= cutoff) next[id] = p;
          else changed = true;
        }
        return changed ? next : prev;
      });
    }, 10_000);
    return () => clearInterval(t);
  }, []);

  // ---- share own location ----
  const lastPostRef = useRef(0);
  const lastPosRef = useRef<{ lng: number; lat: number; accuracy?: number | null } | null>(null);

  useEffect(() => {
    if (!projectId || !share || typeof navigator === "undefined" || !navigator.geolocation) return;

    let watchId: number | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;

    const post = (lng: number, lat: number, accuracy?: number | null) => {
      lastPostRef.current = Date.now();
      lastPosRef.current = { lng, lat, accuracy };
      fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, lng, lat, accuracy, device }),
        keepalive: true,
      }).catch(() => {});
    };

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setGeoError(null);
        const { longitude, latitude, accuracy } = pos.coords;
        if (Date.now() - lastPostRef.current >= MIN_POST_INTERVAL_MS) post(longitude, latitude, accuracy);
        else lastPosRef.current = { lng: longitude, lat: latitude, accuracy };
      },
      (err) => setGeoError(err.message || "Location unavailable"),
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 },
    );

    heartbeat = setInterval(() => {
      const p = lastPosRef.current;
      if (p) post(p.lng, p.lat, p.accuracy);
    }, HEARTBEAT_MS);

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (heartbeat) clearInterval(heartbeat);
      // best-effort leave
      fetch(`/api/presence?projectId=${encodeURIComponent(projectId)}`, { method: "DELETE", keepalive: true }).catch(() => {});
    };
  }, [projectId, share, device]);

  const peers = Object.values(peersMap).filter((p) => p.userId !== selfId);
  return { peers, connected, geoError };
}
