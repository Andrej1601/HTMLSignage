-- Add missing pairing code column for device pairing workflow.
ALTER TABLE "devices"
  ADD COLUMN IF NOT EXISTS "pairingCode" TEXT;

-- Needed by findUnique({ where: { pairingCode } }) in backend routes.
CREATE UNIQUE INDEX IF NOT EXISTS "devices_pairingCode_key"
  ON "devices"("pairingCode");

CREATE INDEX IF NOT EXISTS "devices_pairingCode_idx"
  ON "devices"("pairingCode");
