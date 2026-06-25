-- AlterTable
ALTER TABLE "WatchZone" ADD COLUMN "layerId" TEXT;

-- CreateIndex
CREATE INDEX "WatchZone_layerId_idx" ON "WatchZone"("layerId");

-- AddForeignKey
ALTER TABLE "WatchZone" ADD CONSTRAINT "WatchZone_layerId_fkey" FOREIGN KEY ("layerId") REFERENCES "Layer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
