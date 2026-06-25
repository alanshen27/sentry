// Domain record types used by the repository layer.
import type { WatchZone, HazardEvent } from "@/lib/types";

export interface UserRecord {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
}

export interface WorkspaceRecord {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  createdAt: string;
}

export interface ProjectRecord {
  id: string;
  workspaceId: string;
  ownerId: string;
  name: string;
  description: string | null;
  defaultLat: number;
  defaultLng: number;
  defaultZoom: number;
  createdAt: string;
}

export interface LayerRecord {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  type: string;
  color: string;
  visible: boolean;
  locked: boolean;
  createdAt: string;
}

export interface SegmentRecord {
  id: string;
  projectId: string;
  layerId: string | null;
  workspaceId: string;
  geometry: any;
  label: string | null;
  color: string;
  state: string;
  riskScore: number | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** One entry in a marker's status audit trail. */
export interface MarkerStatusEvent {
  /** Previous state before this change. null for the initial creation entry. */
  from: string | null;
  /** State the marker was set to. */
  state: string;
  byId: string | null;
  byName: string | null;
  at: string;
}

export interface MarkerRecord {
  id: string;
  projectId: string;
  layerId: string | null;
  workspaceId: string;
  geometry: any;
  label: string | null;
  color: string;
  state: string;
  category: string;
  sizeM2: number | null;
  confidence: number | null;
  source: string;
  notes: string | null;
  createdBy: string;
  statusHistory: MarkerStatusEvent[];
  createdAt: string;
  updatedAt: string;
}

/** Marker creation payload — statusHistory is optional (repo seeds an empty array). */
export type MarkerCreateInput = Omit<MarkerRecord, "id" | "createdAt" | "updatedAt" | "statusHistory"> & {
  statusHistory?: MarkerStatusEvent[];
};

export interface TriggerRecord {
  id: string;
  workspaceId: string;
  zoneId: string | null;
  name: string;
  hazard: string;
  metric: string;
  operator: string;
  threshold: number;
  durationMinutes: number;
  cooldownMinutes: number;
  actions: any;
  naturalLanguage: string;
  enabled: boolean;
  lastFired: string | null;
  createdAt: string;
}

export interface AlertRecord {
  id: string;
  workspaceId: string;
  triggerId: string | null;
  zoneId: string | null;
  userId: string | null;
  triggerName: string;
  zoneName: string | null;
  hazard: string;
  message: string;
  severity: string;
  brief: any;
  actions: any;
  acknowledged: boolean;
  createdAt: string;
}

export interface SnapshotRecord {
  id: string;
  zoneId: string | null;
  projectId: string | null;
  result: any;
  createdAt: string;
}

export interface ApiKeyRecord {
  id: string;
  userId: string;
  provider: string;
  maskedKey: string;
  createdAt: string;
}

export interface Repository {
  // users / workspaces
  upsertUser(u: { id: string; email: string; name: string | null }): Promise<UserRecord>;
  listWorkspaces(userId: string): Promise<WorkspaceRecord[]>;
  createWorkspace(name: string, ownerId: string): Promise<WorkspaceRecord>;
  // projects
  listProjects(workspaceId: string): Promise<ProjectRecord[]>;
  createProject(input: { workspaceId: string; ownerId: string; name: string; description?: string; defaultLat?: number; defaultLng?: number; defaultZoom?: number }): Promise<ProjectRecord>;
  getProject(id: string): Promise<ProjectRecord | null>;
  updateProject(id: string, patch: Partial<ProjectRecord>): Promise<ProjectRecord>;
  // layers
  listLayers(projectId: string): Promise<LayerRecord[]>;
  createLayer(input: { projectId: string; name: string; type?: string; color?: string; description?: string }): Promise<LayerRecord>;
  updateLayer(id: string, patch: Partial<LayerRecord>): Promise<LayerRecord>;
  deleteLayer(id: string): Promise<void>;
  // segments
  listSegments(projectId: string, layerId?: string): Promise<SegmentRecord[]>;
  createSegment(input: Omit<SegmentRecord, "id" | "createdAt" | "updatedAt">): Promise<SegmentRecord>;
  updateSegment(id: string, patch: Partial<SegmentRecord>): Promise<SegmentRecord>;
  deleteSegment(id: string): Promise<void>;
  // markers
  listMarkers(projectId: string, filters?: { layerId?: string; state?: string; category?: string; source?: string }): Promise<MarkerRecord[]>;
  createMarker(input: MarkerCreateInput): Promise<MarkerRecord>;
  bulkCreateMarkers(inputs: MarkerCreateInput[]): Promise<MarkerRecord[]>;
  updateMarker(id: string, patch: Partial<MarkerRecord>): Promise<MarkerRecord>;
  /** Change a marker's status and append an audit entry recording who/what/when. */
  setMarkerStatus(id: string, input: { state: string; color?: string; by: { id: string; name: string } }): Promise<MarkerRecord>;
  bulkAssignMarkersToLayer(ids: string[], layerId: string | null): Promise<number>;
  deleteMarker(id: string): Promise<void>;
  // watch zones
  listZones(workspaceId: string, projectId?: string, layerId?: string): Promise<WatchZone[]>;
  createZone(input: { workspaceId: string; projectId?: string; layerId?: string | null; ownerId: string; name: string; geometry: any; hazards: string[]; notes?: string }): Promise<WatchZone>;
  getZone(id: string): Promise<WatchZone | null>;
  updateZone(id: string, patch: { name?: string; geometry?: GeoJSON.Polygon; hazards?: string[]; notes?: string | null; layerId?: string | null }): Promise<WatchZone>;
  deleteZone(id: string): Promise<void>;
  // triggers
  listTriggers(workspaceId: string, zoneId?: string): Promise<TriggerRecord[]>;
  createTrigger(input: Omit<TriggerRecord, "id" | "createdAt" | "lastFired">): Promise<TriggerRecord>;
  updateTrigger(id: string, patch: Partial<TriggerRecord>): Promise<TriggerRecord>;
  deleteTrigger(id: string): Promise<void>;
  // alerts
  listAlerts(workspaceId: string): Promise<AlertRecord[]>;
  createAlert(input: Omit<AlertRecord, "id" | "createdAt" | "acknowledged">): Promise<AlertRecord>;
  acknowledgeAlert(id: string): Promise<void>;
  // snapshots
  createSnapshot(input: { zoneId?: string; projectId?: string; result: any }): Promise<SnapshotRecord>;
  listSnapshots(zoneId?: string, projectId?: string): Promise<SnapshotRecord[]>;
  // api keys
  upsertApiKey(userId: string, provider: string, maskedKey: string): Promise<ApiKeyRecord>;
  listApiKeys(userId: string): Promise<ApiKeyRecord[]>;

  // shared ingested hazard events (written by background ingest worker)
  upsertHazardEvents(events: HazardEvent[]): Promise<number>;
  listHazardEvents(opts?: { types?: string[]; bbox?: number[]; sinceHours?: number; limit?: number }): Promise<HazardEvent[]>;
  hazardEventStats(): Promise<{ total: number; bySource: Record<string, number>; mostRecent: string | null }>;
  recordIngestRun(input: { source: string; count: number; ok: boolean; error?: string | null; finishedAt?: string }): Promise<void>;
  listIngestRuns(limit?: number): Promise<{ id: string; source: string; count: number; ok: boolean; error: string | null; startedAt: string; finishedAt: string | null }[]>;
}
