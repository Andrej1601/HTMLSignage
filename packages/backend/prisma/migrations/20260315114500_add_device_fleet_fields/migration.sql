-- Add group and maintenance state to device fleet management.
ALTER TABLE "devices"
  ADD COLUMN IF NOT EXISTS "groupName" TEXT,
  ADD COLUMN IF NOT EXISTS "maintenanceMode" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "devices_groupName_idx"
  ON "devices"("groupName");

CREATE INDEX IF NOT EXISTS "devices_maintenanceMode_idx"
  ON "devices"("maintenanceMode");
