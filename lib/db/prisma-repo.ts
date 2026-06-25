import type { Repository } from "./repository";
import type {
  AlertRecord, ApiKeyRecord, LayerRecord, MarkerRecord, ProjectRecord,
  SegmentRecord, SnapshotRecord, TriggerRecord, UserRecord, WorkspaceRecord,
} from "./repository";
import type { WatchZone, HazardEvent } from "@/lib/types";
import { getPrisma } from "./prisma";

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "ws";
}

function inBbox(g: GeoJSON.Geometry, bbox: number[]): boolean {
  if (g.type !== "Point") return false;
  const [lng, lat] = g.coordinates as [number, number];
  return lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3];
}

function toWorkspace(w: any): WorkspaceRecord {
  return { id: w.id, name: w.name, slug: w.slug, ownerId: w.ownerId, createdAt: w.createdAt.toISOString() };
}
function toProject(p: any): ProjectRecord {
  return { id: p.id, workspaceId: p.workspaceId, ownerId: p.ownerId, name: p.name, description: p.description, defaultLat: p.defaultLat, defaultLng: p.defaultLng, defaultZoom: p.defaultZoom, createdAt: p.createdAt.toISOString() };
}
function toLayer(l: any): LayerRecord {
  return { id: l.id, projectId: l.projectId, name: l.name, description: l.description, type: l.type, color: l.color, visible: l.visible, locked: l.locked, createdAt: l.createdAt.toISOString() };
}
function toSegment(s: any): SegmentRecord {
  return { id: s.id, projectId: s.projectId, layerId: s.layerId, workspaceId: s.workspaceId, geometry: s.geometry, label: s.label, color: s.color, state: s.state, riskScore: s.riskScore, notes: s.notes, createdBy: s.createdBy, createdAt: s.createdAt.toISOString(), updatedAt: s.updatedAt.toISOString() };
}
function toMarker(m: any): MarkerRecord {
  return { id: m.id, projectId: m.projectId, layerId: m.layerId, workspaceId: m.workspaceId, geometry: m.geometry, label: m.label, color: m.color, state: m.state, category: m.category, sizeM2: m.sizeM2, confidence: m.confidence, source: m.source, notes: m.notes, createdBy: m.createdBy, statusHistory: Array.isArray(m.statusHistory) ? m.statusHistory : [], createdAt: m.createdAt.toISOString(), updatedAt: m.updatedAt.toISOString() };
}
function toZone(z: any): WatchZone {
  return { id: z.id, name: z.name, geometry: z.geometry, createdAt: z.createdAt.toISOString(), hazards: z.hazards ?? [], triggers: (z.triggers ?? []).map(toTrigger), notes: z.notes, layerId: z.layerId ?? null, projectId: z.projectId ?? null };
}
function toTrigger(t: any): TriggerRecord {
  return { id: t.id, workspaceId: t.workspaceId, zoneId: t.zoneId, name: t.name, hazard: t.hazard, metric: t.metric, operator: t.operator, threshold: t.threshold, durationMinutes: t.durationMinutes, cooldownMinutes: t.cooldownMinutes, actions: t.actions, naturalLanguage: t.naturalLanguage, enabled: t.enabled, lastFired: t.lastFired ? t.lastFired.toISOString() : null, createdAt: t.createdAt.toISOString() };
}
function toAlert(a: any): AlertRecord {
  return { id: a.id, workspaceId: a.workspaceId, triggerId: a.triggerId, zoneId: a.zoneId, userId: a.userId, triggerName: a.triggerName, zoneName: a.zoneName, hazard: a.hazard, message: a.message, severity: a.severity, brief: a.brief, actions: a.actions, acknowledged: a.acknowledged, createdAt: a.createdAt.toISOString() };
}

export const prismaRepo: Repository = {
  async upsertUser(u) {
    const prisma = getPrisma();
    const row = await prisma.user.upsert({ where: { email: u.email }, update: { name: u.name ?? undefined }, create: { id: u.id, email: u.email, name: u.name } });
    return { id: row.id, email: row.email, name: row.name, role: row.role, createdAt: row.createdAt.toISOString() };
  },
  async listWorkspaces(userId) {
    const prisma = getPrisma();
    const members = await prisma.workspaceMember.findMany({ where: { userId }, include: { workspace: true } });
    return members.map((m) => toWorkspace(m.workspace));
  },
  async createWorkspace(name, ownerId) {
    const prisma = getPrisma();
    const row = await prisma.workspace.create({ data: { name, slug: slugify(name) + "-" + Math.random().toString(36).slice(2, 6), ownerId, members: { create: { userId: ownerId, role: "admin" } } } });
    return toWorkspace(row);
  },
  async listProjects(workspaceId) {
    const prisma = getPrisma();
    const rows = await prisma.project.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } });
    return rows.map(toProject);
  },
  async createProject(input) {
    const prisma = getPrisma();
    const row = await prisma.project.create({ data: { workspaceId: input.workspaceId, ownerId: input.ownerId, name: input.name, description: input.description ?? null, defaultLat: input.defaultLat ?? 0, defaultLng: input.defaultLng ?? 0, defaultZoom: input.defaultZoom ?? 2 } });
    return toProject(row);
  },
  async getProject(id) {
    const prisma = getPrisma();
    const row = await prisma.project.findUnique({ where: { id } });
    return row ? toProject(row) : null;
  },
  async updateProject(id, patch) {
    const prisma = getPrisma();
    const data: any = {};
    if (patch.name !== undefined) data.name = patch.name;
    if (patch.description !== undefined) data.description = patch.description;
    if (patch.defaultLat !== undefined) data.defaultLat = patch.defaultLat;
    if (patch.defaultLng !== undefined) data.defaultLng = patch.defaultLng;
    if (patch.defaultZoom !== undefined) data.defaultZoom = patch.defaultZoom;
    const row = await prisma.project.update({ where: { id }, data });
    return toProject(row);
  },
  async listLayers(projectId) {
    const prisma = getPrisma();
    const rows = await prisma.layer.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } });
    return rows.map(toLayer);
  },
  async createLayer(input) {
    const prisma = getPrisma();
    const row = await prisma.layer.create({ data: { projectId: input.projectId, name: input.name, description: input.description ?? null, type: input.type ?? "overlay", color: input.color ?? "#38bdf8" } });
    return toLayer(row);
  },
  async updateLayer(id, patch) {
    const prisma = getPrisma();
    const data: any = {};
    for (const k of ["name", "color", "visible", "locked", "type"] as const) if ((patch as any)[k] !== undefined) data[k] = (patch as any)[k];
    const row = await prisma.layer.update({ where: { id }, data });
    return toLayer(row);
  },
  async deleteLayer(id) {
    const prisma = getPrisma();
    await prisma.layer.delete({ where: { id } });
  },
  async listSegments(projectId, layerId) {
    const prisma = getPrisma();
    const rows = await prisma.segment.findMany({ where: { projectId, ...(layerId ? { layerId } : {}) }, orderBy: { createdAt: "desc" } });
    return rows.map(toSegment);
  },
  async createSegment(input) {
    const prisma = getPrisma();
    const row = await prisma.segment.create({ data: input });
    return toSegment(row);
  },
  async updateSegment(id, patch) {
    const prisma = getPrisma();
    const data: any = {};
    for (const k of ["label", "color", "state", "riskScore", "notes", "layerId"] as const) if ((patch as any)[k] !== undefined) data[k] = (patch as any)[k];
    const row = await prisma.segment.update({ where: { id }, data: { ...data, updatedAt: new Date() } });
    return toSegment(row);
  },
  async deleteSegment(id) {
    const prisma = getPrisma();
    await prisma.segment.delete({ where: { id } });
  },
  async listMarkers(projectId, filters) {
    const prisma = getPrisma();
    const where: any = { projectId };
    if (filters?.layerId) where.layerId = filters.layerId;
    if (filters?.state) where.state = filters.state;
    if (filters?.category) where.category = filters.category;
    if (filters?.source) where.source = filters.source;
    const rows = await prisma.marker.findMany({ where, orderBy: { createdAt: "desc" } });
    return rows.map(toMarker);
  },
  async createMarker(input) {
    const prisma = getPrisma();
    const { statusHistory, ...rest } = input as any;
    const row = await prisma.marker.create({ data: { ...rest, statusHistory: (statusHistory ?? []) as any } });
    return toMarker(row);
  },
  async bulkCreateMarkers(inputs) {
    const prisma = getPrisma();
    const created = await prisma.$transaction(inputs.map((input) => {
      const { statusHistory, ...rest } = input as any;
      return prisma.marker.create({ data: { ...rest, statusHistory: (statusHistory ?? []) as any } });
    }));
    return created.map(toMarker);
  },
  async updateMarker(id, patch) {
    const prisma = getPrisma();
    const data: any = {};
    for (const k of ["label", "color", "state", "category", "sizeM2", "confidence", "notes", "layerId"] as const) if ((patch as any)[k] !== undefined) data[k] = (patch as any)[k];
    const row = await prisma.marker.update({ where: { id }, data: { ...data, updatedAt: new Date() } });
    return toMarker(row);
  },
  async setMarkerStatus(id, { state, color, by }) {
    const prisma = getPrisma();
    const cur = await prisma.marker.findUnique({ where: { id } });
    if (!cur) throw new Error("marker not found");
    const history = Array.isArray(cur.statusHistory) ? (cur.statusHistory as any[]) : [];
    const event = { from: cur.state ?? null, state, byId: by.id, byName: by.name, at: new Date().toISOString() };
    const row = await prisma.marker.update({
      where: { id },
      data: { state, ...(color ? { color } : {}), statusHistory: [...history, event] as any, updatedAt: new Date() },
    });
    return toMarker(row);
  },
  async bulkAssignMarkersToLayer(ids, layerId) {
    if (!ids.length) return 0;
    const prisma = getPrisma();
    const result = await prisma.marker.updateMany({ where: { id: { in: ids } }, data: { layerId, updatedAt: new Date() } });
    return result.count;
  },
  async deleteMarker(id) {
    const prisma = getPrisma();
    await prisma.marker.delete({ where: { id } });
  },
  async listZones(workspaceId, projectId, layerId) {
    const prisma = getPrisma();
    const rows = await prisma.watchZone.findMany({
      where: {
        workspaceId,
        ...(projectId ? { projectId } : {}),
        ...(layerId ? { layerId } : {}),
      },
      include: { triggers: true },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toZone);
  },
  async createZone(input) {
    const prisma = getPrisma();
    const row = await prisma.watchZone.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: input.projectId ?? null,
        layerId: input.layerId ?? null,
        ownerId: input.ownerId,
        name: input.name,
        geometry: input.geometry as any,
        hazards: input.hazards as any,
        notes: input.notes ?? null,
      },
      include: { triggers: true },
    });
    return toZone(row);
  },
  async getZone(id) {
    const prisma = getPrisma();
    const row = await prisma.watchZone.findUnique({ where: { id }, include: { triggers: true } });
    return row ? toZone(row) : null;
  },
  async updateZone(id, patch) {
    const prisma = getPrisma();
    const data: Record<string, unknown> = {};
    if (patch.name !== undefined) data.name = patch.name;
    if (patch.geometry !== undefined) data.geometry = patch.geometry;
    if (patch.hazards !== undefined) data.hazards = patch.hazards;
    if (patch.notes !== undefined) data.notes = patch.notes;
    if (patch.layerId !== undefined) data.layerId = patch.layerId;
    const row = await prisma.watchZone.update({ where: { id }, data, include: { triggers: true } });
    return toZone(row);
  },
  async deleteZone(id) {
    const prisma = getPrisma();
    await prisma.watchZone.delete({ where: { id } });
  },
  async listTriggers(workspaceId, zoneId) {
    const prisma = getPrisma();
    const rows = await prisma.triggerRule.findMany({ where: { workspaceId, ...(zoneId ? { zoneId } : {}) }, orderBy: { createdAt: "desc" } });
    return rows.map(toTrigger);
  },
  async createTrigger(input) {
    const prisma = getPrisma();
    const row = await prisma.triggerRule.create({ data: input });
    return toTrigger(row);
  },
  async updateTrigger(id, patch) {
    const prisma = getPrisma();
    const data: any = {};
    for (const k of ["name", "enabled", "threshold", "operator", "metric", "durationMinutes", "cooldownMinutes", "actions", "naturalLanguage", "lastFired"] as const) if ((patch as any)[k] !== undefined) data[k] = (patch as any)[k];
    const row = await prisma.triggerRule.update({ where: { id }, data });
    return toTrigger(row);
  },
  async deleteTrigger(id) {
    const prisma = getPrisma();
    await prisma.triggerRule.delete({ where: { id } });
  },
  async listAlerts(workspaceId) {
    const prisma = getPrisma();
    const rows = await prisma.alertRecord.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } });
    return rows.map(toAlert);
  },
  async createAlert(input) {
    const prisma = getPrisma();
    const row = await prisma.alertRecord.create({ data: input });
    return toAlert(row);
  },
  async acknowledgeAlert(id) {
    const prisma = getPrisma();
    await prisma.alertRecord.update({ where: { id }, data: { acknowledged: true } });
  },
  async createSnapshot(input) {
    const prisma = getPrisma();
    const row = await prisma.analysisSnapshot.create({ data: input });
    return { id: row.id, zoneId: row.zoneId, projectId: row.projectId, result: row.result, createdAt: row.createdAt.toISOString() } as SnapshotRecord;
  },
  async listSnapshots(zoneId, projectId) {
    const prisma = getPrisma();
    const rows = await prisma.analysisSnapshot.findMany({ where: { ...(zoneId ? { zoneId } : {}), ...(projectId ? { projectId } : {}) }, orderBy: { createdAt: "desc" } });
    return rows.map((r) => ({ id: r.id, zoneId: r.zoneId, projectId: r.projectId, result: r.result, createdAt: r.createdAt.toISOString() } as SnapshotRecord));
  },
  async upsertApiKey(userId, provider, maskedKey) {
    const prisma = getPrisma();
    const row = await prisma.apiKey.upsert({ where: { userId_provider: { userId, provider } }, update: { maskedKey }, create: { userId, provider, maskedKey } });
    return { id: row.id, userId: row.userId, provider: row.provider, maskedKey: row.maskedKey, createdAt: row.createdAt.toISOString() } as ApiKeyRecord;
  },
  async listApiKeys(userId) {
    const prisma = getPrisma();
    const rows = await prisma.apiKey.findMany({ where: { userId } });
    return rows.map((r) => ({ id: r.id, userId: r.userId, provider: r.provider, maskedKey: r.maskedKey, createdAt: r.createdAt.toISOString() } as ApiKeyRecord));
  },

  async upsertHazardEvents(events) {
    if (!events.length) return 0;
    const prisma = getPrisma();
    let n = 0;
    // chunk to avoid oversized transactions
    for (let i = 0; i < events.length; i += 200) {
      const chunk = events.slice(i, i + 200);
      await prisma.$transaction(
        chunk.map((e) =>
          prisma.hazardEventRecord.upsert({
            where: { source_sourceId: { source: e.source, sourceId: e.id } },
            update: { type: e.type, geometry: e.geometry as any, severity: e.severity, confidence: e.confidence, observedAt: new Date(e.observedAt), properties: (e.properties ?? {}) as any, ingestedAt: new Date() },
            create: { source: e.source, sourceId: e.id, type: e.type, geometry: e.geometry as any, severity: e.severity, confidence: e.confidence, observedAt: new Date(e.observedAt), properties: (e.properties ?? {}) as any },
          })
        )
      );
      n += chunk.length;
    }
    return n;
  },

  async listHazardEvents(opts) {
    const prisma = getPrisma();
    const where: any = {};
    if (opts?.types?.length) where.type = { in: opts.types };
    if (opts?.sinceHours) where.observedAt = { gte: new Date(Date.now() - opts.sinceHours * 3600 * 1000) };
    const rows = await prisma.hazardEventRecord.findMany({
      where,
      orderBy: { observedAt: "desc" },
      take: Math.min(opts?.limit ?? 1000, 5000),
    });
    let out = rows.map((r) => ({
      id: r.sourceId, type: r.type, source: r.source, geometry: r.geometry as any,
      severity: r.severity, confidence: r.confidence, observedAt: r.observedAt.toISOString(),
      properties: r.properties,
    } as unknown as HazardEvent));
    if (opts?.bbox) {
      const [minLng, minLat, maxLng, maxLat] = opts.bbox;
      out = out.filter((e) => e.geometry.type === "Point" && inBbox(e.geometry, [minLng, minLat, maxLng, maxLat]));
    }
    return out;
  },

  async hazardEventStats() {
    const prisma = getPrisma();
    const [total, bySourceRows, latest] = await Promise.all([
      prisma.hazardEventRecord.count(),
      prisma.hazardEventRecord.groupBy({ by: ["source"], _count: { _all: true } }),
      prisma.hazardEventRecord.findFirst({ orderBy: { ingestedAt: "desc" }, select: { ingestedAt: true } }),
    ]);
    const bySource: Record<string, number> = {};
    for (const r of bySourceRows) bySource[r.source] = r._count._all;
    return { total, bySource, mostRecent: latest?.ingestedAt ? latest.ingestedAt.toISOString() : null };
  },

  async recordIngestRun(input) {
    const prisma = getPrisma();
    await prisma.ingestRun.create({ data: { source: input.source, count: input.count, ok: input.ok, error: input.error ?? null, finishedAt: input.finishedAt ? new Date(input.finishedAt) : null } });
  },

  async listIngestRuns(limit) {
    const prisma = getPrisma();
    const rows = await prisma.ingestRun.findMany({ orderBy: { startedAt: "desc" }, take: limit ?? 20 });
    return rows.map((r) => ({ id: r.id, source: r.source, count: r.count, ok: r.ok, error: r.error, startedAt: r.startedAt.toISOString(), finishedAt: r.finishedAt ? r.finishedAt.toISOString() : null }));
  },
};
