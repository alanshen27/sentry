import Redis from "ioredis";

declare global {
  // eslint-disable-next-line no-var
  var __redis: Redis | undefined;
}

export function getRedis(): Redis | null {
  if (!process.env.REDIS_URL) return null;
  if (!global.__redis) {
    try {
      global.__redis = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 2,
        lazyConnect: false,
        connectTimeout: 3000,
      });
    } catch {
      return null;
    }
  }
  return global.__redis;
}

export function hasRedis(): boolean {
  return Boolean(process.env.REDIS_URL);
}
