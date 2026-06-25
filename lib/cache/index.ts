import { getRedis, hasRedis } from "./redis";

export interface Cache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  getOrSet<T>(key: string, factory: () => Promise<T>, ttlSeconds?: number): Promise<T>;
}

function serialize<T>(v: T): string {
  return JSON.stringify(v);
}
function deserialize<T>(s: string): T {
  return JSON.parse(s) as T;
}

export const redisCache: Cache = {
  async get<T>(key: string) {
    const r = getRedis()!;
    const s = await r.get(key);
    return s ? deserialize<T>(s) : null;
  },
  async set<T>(key: string, value: T, ttlSeconds?: number) {
    const r = getRedis()!;
    if (ttlSeconds) await r.set(key, serialize(value), "EX", ttlSeconds);
    else await r.set(key, serialize(value));
  },
  async del(key: string) {
    const r = getRedis()!;
    await r.del(key);
  },
  async getOrSet<T>(key: string, factory: () => Promise<T>, ttlSeconds?: number) {
    const existing = await this.get<T>(key);
    if (existing !== null) return existing;
    const fresh = await factory();
    await this.set(key, fresh, ttlSeconds);
    return fresh;
  },
};

// No-op cache: used only when REDIS_URL is absent. Caching is simply disabled —
// there is no in-memory store, so this never serves stale data across instances.
export const nullCache: Cache = {
  async get() { return null; },
  async set() {},
  async del() {},
  async getOrSet<T>(_key: string, factory: () => Promise<T>) {
    return factory();
  },
};

let cached: Cache | null = null;
export function getCache(): Cache {
  if (cached) return cached;
  cached = hasRedis() ? redisCache : nullCache;
  return cached;
}

export function cacheMode(): "redis" | "off" {
  return hasRedis() ? "redis" : "off";
}
