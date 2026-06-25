-- Add audit trail of marker status changes (who set what state, from what, when).
ALTER TABLE "Marker" ADD COLUMN "statusHistory" JSONB NOT NULL DEFAULT '[]';
