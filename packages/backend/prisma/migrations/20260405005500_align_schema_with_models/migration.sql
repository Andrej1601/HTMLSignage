-- Align database schema with the current Prisma models.

-- Sessions: legacy installs still use the old `token` column.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sessions'
      AND column_name = 'token'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sessions'
      AND column_name = 'tokenHash'
  ) THEN
    ALTER TABLE "sessions" RENAME COLUMN "token" TO "tokenHash";
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "sessions_tokenHash_key"
  ON "sessions"("tokenHash");

-- Slideshows table was introduced after the original init migration.
CREATE TABLE IF NOT EXISTS "slideshows" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slideshows_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "slideshows_isDefault_idx"
  ON "slideshows"("isDefault");

-- Devices: support slideshow assignment and token revocation.
ALTER TABLE "devices"
  ADD COLUMN IF NOT EXISTS "slideshowId" TEXT,
  ADD COLUMN IF NOT EXISTS "tokenRevokedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "devices_tokenRevokedAt_idx"
  ON "devices"("tokenRevokedAt");

CREATE INDEX IF NOT EXISTS "devices_slideshowId_idx"
  ON "devices"("slideshowId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'devices_slideshowId_fkey'
  ) THEN
    ALTER TABLE "devices"
      ADD CONSTRAINT "devices_slideshowId_fkey"
      FOREIGN KEY ("slideshowId") REFERENCES "slideshows"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Tables used by palettes UI and system job tracking.
CREATE TABLE IF NOT EXISTS "custom_palettes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "colors" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_palettes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "system_jobs" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "requestId" TEXT,
    "createdBy" JSONB,
    "progress" JSONB,
    "log" TEXT NOT NULL DEFAULT '',
    "result" JSONB,
    "error" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "system_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "system_jobs_status_createdAt_idx"
  ON "system_jobs"("status", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "system_jobs_type_status_idx"
  ON "system_jobs"("type", "status");

CREATE INDEX IF NOT EXISTS "system_jobs_createdAt_idx"
  ON "system_jobs"("createdAt" DESC);
