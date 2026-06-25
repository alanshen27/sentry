import type { Repository } from "./repository";
import { hasDatabase, getPrisma } from "./prisma";
import { prismaRepo } from "./prisma-repo";

let cached: Repository | null = null;

export function getRepo(): Repository {
  if (cached) return cached;
  if (!hasDatabase()) {
    throw new Error(
      "DATABASE_URL is required. Sentry runs on Postgres (Prisma) in production — no local fallback."
    );
  }
  // touch the client to fail fast on bad connection config
  getPrisma();
  cached = prismaRepo;
  return cached;
}

export function dbMode(): "prisma" {
  return "prisma";
}

export type { Repository } from "./repository";
export type {
  UserRecord, WorkspaceRecord, ProjectRecord, LayerRecord, SegmentRecord,
  MarkerRecord, TriggerRecord, AlertRecord, SnapshotRecord, ApiKeyRecord,
} from "./repository";
