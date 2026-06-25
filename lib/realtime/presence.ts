import { EventEmitter } from "events";
import type Redis from "ioredis";
import { getRedis, hasRedis } from "@/lib/cache/redis";

/** Live location of a collaborator within a project "room". */
export interface Presence {
  userId: string;
  name: string;
  color: string;
  lng: number;
  lat: number;
  accuracy?: number | null;
  device?: "mobile" | "desktop";
  at: string;
}

export type PresenceEvent =
  | { type: "update"; presence: Presence }
  | { type: "leave"; userId: string };

/** Presence is considered stale (user went offline) after this long without a heartbeat. */
export const PRESENCE_TTL_MS = 45_000;
const PRESENCE_TTL_S = 60;

const PALETTE = [
  "#f43f5e", "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f59e0b",
];

/** Stable, distinct color for a user id. */
export function colorForUser(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

// ---- singletons (survive Next HMR via globalThis) --------------------------
declare global {
  // eslint-disable-next-line no-var
  var __presenceBus: EventEmitter | undefined;
  // eslint-disable-next-line no-var
  var __presenceMem: Map<string, Map<string, Presence>> | undefined;
  // eslint-disable-next-line no-var
  var __presenceSub: Redis | undefined;
}

function bus(): EventEmitter {
  if (!global.__presenceBus) {
    global.__presenceBus = new EventEmitter();
    global.__presenceBus.setMaxListeners(0);
  }
  return global.__presenceBus;
}

function mem(): Map<string, Map<string, Presence>> {
  if (!global.__presenceMem) global.__presenceMem = new Map();
  return global.__presenceMem;
}

const roomKey = (projectId: string) => `presence:room:${projectId}`;
const evtChannel = (projectId: string) => `presence:evt:${projectId}`;
const localEvt = (projectId: string) => `evt:${projectId}`;

/**
 * Lazily open a dedicated Redis subscriber that re-broadcasts cross-instance
 * presence events onto the in-process EventEmitter that SSE handlers listen on.
 */
function ensureRedisSub(): void {
  if (!hasRedis() || global.__presenceSub) return;
  const base = getRedis();
  if (!base) return;
  try {
    const sub = base.duplicate();
    sub.psubscribe(evtChannel("*")).catch(() => {});
    sub.on("pmessage", (_pattern, channel, message) => {
      const projectId = channel.slice("presence:evt:".length);
      try {
        bus().emit(localEvt(projectId), JSON.parse(message) as PresenceEvent);
      } catch {
        /* ignore malformed */
      }
    });
    global.__presenceSub = sub;
  } catch {
    /* fall back to in-memory bus */
  }
}

async function publish(projectId: string, evt: PresenceEvent): Promise<void> {
  if (hasRedis()) {
    try {
      // The subscriber (same process) will fan this back onto the local bus,
      // so we don't emit locally here to avoid duplicate delivery.
      await getRedis()?.publish(evtChannel(projectId), JSON.stringify(evt));
      return;
    } catch {
      /* fall through to local bus */
    }
  }
  bus().emit(localEvt(projectId), evt);
}

/** Store/refresh a user's presence in a project and broadcast it. */
export async function setPresence(projectId: string, p: Presence): Promise<void> {
  ensureRedisSub();
  if (hasRedis()) {
    try {
      const r = getRedis();
      await r?.hset(roomKey(projectId), p.userId, JSON.stringify(p));
      await r?.expire(roomKey(projectId), PRESENCE_TTL_S);
    } catch {
      /* ignore */
    }
  } else {
    let room = mem().get(projectId);
    if (!room) { room = new Map(); mem().set(projectId, room); }
    room.set(p.userId, p);
  }
  await publish(projectId, { type: "update", presence: p });
}

/** Current (non-stale) presences for a project. Prunes stale entries lazily. */
export async function getPresence(projectId: string): Promise<Presence[]> {
  const now = Date.now();
  if (hasRedis()) {
    try {
      const r = getRedis();
      const all = (await r?.hgetall(roomKey(projectId))) ?? {};
      const out: Presence[] = [];
      for (const [uid, val] of Object.entries(all)) {
        try {
          const p = JSON.parse(val) as Presence;
          if (now - new Date(p.at).getTime() < PRESENCE_TTL_MS) out.push(p);
          else await r?.hdel(roomKey(projectId), uid);
        } catch {
          /* skip */
        }
      }
      return out;
    } catch {
      return [];
    }
  }
  const room = mem().get(projectId);
  if (!room) return [];
  const out: Presence[] = [];
  for (const [uid, p] of room) {
    if (now - new Date(p.at).getTime() < PRESENCE_TTL_MS) out.push(p);
    else room.delete(uid);
  }
  return out;
}

/** Remove a user's presence (explicit leave) and broadcast it. */
export async function removePresence(projectId: string, userId: string): Promise<void> {
  ensureRedisSub();
  if (hasRedis()) {
    try { await getRedis()?.hdel(roomKey(projectId), userId); } catch { /* ignore */ }
  } else {
    mem().get(projectId)?.delete(userId);
  }
  await publish(projectId, { type: "leave", userId });
}

/** Subscribe to presence events for a project. Returns an unsubscribe fn. */
export function subscribePresence(projectId: string, handler: (e: PresenceEvent) => void): () => void {
  ensureRedisSub();
  const ch = localEvt(projectId);
  bus().on(ch, handler);
  return () => { bus().off(ch, handler); };
}

export function presenceBackend(): "redis" | "memory" {
  return hasRedis() ? "redis" : "memory";
}
