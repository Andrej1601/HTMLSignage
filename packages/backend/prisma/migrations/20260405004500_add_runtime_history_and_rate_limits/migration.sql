-- Add missing tables for runtime snapshots and auth rate limiting.
CREATE TABLE IF NOT EXISTS "runtime_history" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diskUsagePercent" DOUBLE PRECISION NOT NULL,
    "pairedDevices" INTEGER NOT NULL,
    "onlineDevices" INTEGER NOT NULL,
    "offlineDevices" INTEGER NOT NULL,
    "staleDevices" INTEGER NOT NULL,
    "neverSeenDevices" INTEGER NOT NULL,
    "missingMediaFiles" INTEGER NOT NULL,
    "orphanMediaFiles" INTEGER NOT NULL,
    "warningCount" INTEGER NOT NULL,
    "deviceWarningCount" INTEGER NOT NULL,
    "systemWarningCount" INTEGER NOT NULL,
    "maintenanceState" TEXT NOT NULL,

    CONSTRAINT "runtime_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "runtime_history_timestamp_idx"
  ON "runtime_history"("timestamp" DESC);

CREATE TABLE IF NOT EXISTS "rate_limits" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "rate_limits_key_key"
  ON "rate_limits"("key");

CREATE INDEX IF NOT EXISTS "rate_limits_expiresAt_idx"
  ON "rate_limits"("expiresAt");
