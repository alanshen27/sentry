-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'analyst',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceMember" (
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'analyst',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("workspaceId","userId")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "defaultLat" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "defaultLng" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "defaultZoom" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Layer" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'overlay',
    "color" TEXT NOT NULL DEFAULT '#38bdf8',
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Layer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Segment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "layerId" TEXT,
    "workspaceId" TEXT NOT NULL,
    "geometry" JSONB NOT NULL,
    "label" TEXT,
    "color" TEXT NOT NULL DEFAULT '#38bdf8',
    "state" TEXT NOT NULL DEFAULT 'active',
    "riskScore" DOUBLE PRECISION,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Segment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Marker" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "layerId" TEXT,
    "workspaceId" TEXT NOT NULL,
    "geometry" JSONB NOT NULL,
    "label" TEXT,
    "color" TEXT NOT NULL DEFAULT '#f97316',
    "state" TEXT NOT NULL DEFAULT 'pending',
    "category" TEXT NOT NULL DEFAULT 'observation',
    "sizeM2" DOUBLE PRECISION,
    "confidence" DOUBLE PRECISION,
    "source" TEXT NOT NULL DEFAULT 'user',
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Marker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchZone" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "workspaceId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "geometry" JSONB NOT NULL,
    "hazards" JSONB NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WatchZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TriggerRule" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "zoneId" TEXT,
    "name" TEXT NOT NULL,
    "hazard" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 0,
    "cooldownMinutes" INTEGER NOT NULL DEFAULT 30,
    "actions" JSONB NOT NULL,
    "naturalLanguage" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastFired" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TriggerRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertRecord" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "triggerId" TEXT,
    "zoneId" TEXT,
    "userId" TEXT,
    "triggerName" TEXT NOT NULL,
    "zoneName" TEXT,
    "hazard" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "brief" JSONB,
    "actions" JSONB NOT NULL,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisSnapshot" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT,
    "projectId" TEXT,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalysisSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "maskedKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

-- CreateIndex
CREATE INDEX "Project_workspaceId_idx" ON "Project"("workspaceId");

-- CreateIndex
CREATE INDEX "Layer_projectId_idx" ON "Layer"("projectId");

-- CreateIndex
CREATE INDEX "Segment_projectId_idx" ON "Segment"("projectId");

-- CreateIndex
CREATE INDEX "Segment_layerId_idx" ON "Segment"("layerId");

-- CreateIndex
CREATE INDEX "Marker_projectId_idx" ON "Marker"("projectId");

-- CreateIndex
CREATE INDEX "Marker_layerId_idx" ON "Marker"("layerId");

-- CreateIndex
CREATE INDEX "Marker_state_idx" ON "Marker"("state");

-- CreateIndex
CREATE INDEX "WatchZone_workspaceId_idx" ON "WatchZone"("workspaceId");

-- CreateIndex
CREATE INDEX "WatchZone_projectId_idx" ON "WatchZone"("projectId");

-- CreateIndex
CREATE INDEX "TriggerRule_workspaceId_idx" ON "TriggerRule"("workspaceId");

-- CreateIndex
CREATE INDEX "TriggerRule_zoneId_idx" ON "TriggerRule"("zoneId");

-- CreateIndex
CREATE INDEX "AlertRecord_workspaceId_idx" ON "AlertRecord"("workspaceId");

-- CreateIndex
CREATE INDEX "AlertRecord_createdAt_idx" ON "AlertRecord"("createdAt");

-- CreateIndex
CREATE INDEX "AnalysisSnapshot_zoneId_idx" ON "AnalysisSnapshot"("zoneId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_userId_provider_key" ON "ApiKey"("userId", "provider");

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Layer" ADD CONSTRAINT "Layer_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Segment" ADD CONSTRAINT "Segment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Segment" ADD CONSTRAINT "Segment_layerId_fkey" FOREIGN KEY ("layerId") REFERENCES "Layer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Segment" ADD CONSTRAINT "Segment_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Marker" ADD CONSTRAINT "Marker_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Marker" ADD CONSTRAINT "Marker_layerId_fkey" FOREIGN KEY ("layerId") REFERENCES "Layer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Marker" ADD CONSTRAINT "Marker_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchZone" ADD CONSTRAINT "WatchZone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchZone" ADD CONSTRAINT "WatchZone_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerRule" ADD CONSTRAINT "TriggerRule_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerRule" ADD CONSTRAINT "TriggerRule_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "WatchZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertRecord" ADD CONSTRAINT "AlertRecord_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertRecord" ADD CONSTRAINT "AlertRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisSnapshot" ADD CONSTRAINT "AnalysisSnapshot_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "WatchZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisSnapshot" ADD CONSTRAINT "AnalysisSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
