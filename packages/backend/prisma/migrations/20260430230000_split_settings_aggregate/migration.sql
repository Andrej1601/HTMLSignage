-- Split Settings aggregate into dedicated tables for Sauna, Aroma,
-- InfoItem, and Event. The Settings.data JSON still mirrors these
-- arrays at GET time for backwards compatibility — this migration
-- backfills the four new tables from the active Settings record.

-- CreateTable
CREATE TABLE "saunas" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "order" INTEGER NOT NULL DEFAULT 0,
    "imageId" TEXT,
    "color" TEXT,
    "description" TEXT,
    "info" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saunas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "saunas_order_idx" ON "saunas"("order");

-- CreateTable
CREATE TABLE "aromas" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "color" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aromas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "aromas_order_idx" ON "aromas"("order");

-- CreateTable
CREATE TABLE "info_items" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "imageId" TEXT,
    "imageMode" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "info_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "info_items_order_idx" ON "info_items"("order");

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageId" TEXT,
    "startDate" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endDate" TEXT,
    "endTime" TEXT,
    "assignedPreset" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "targetDeviceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "slideshowId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "events_slideshowId_idx" ON "events"("slideshowId");
CREATE INDEX "events_isActive_idx" ON "events"("isActive");
CREATE INDEX "events_order_idx" ON "events"("order");

ALTER TABLE "events"
  ADD CONSTRAINT "events_slideshowId_fkey"
  FOREIGN KEY ("slideshowId") REFERENCES "slideshows"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Backfill from active Settings.data ─────────────────────────────────────
-- Use a CTE to pick the latest active settings record once. If multiple
-- active rows exist (shouldn't in steady-state) we take the highest version.
WITH active AS (
  SELECT data FROM settings
  WHERE "isActive" = true
  ORDER BY version DESC
  LIMIT 1
)
INSERT INTO "saunas" ("id", "name", "status", "order", "imageId", "color", "description", "info", "createdAt", "updatedAt")
SELECT
  COALESCE(elem->>'id', 'sauna-' || ord::text),
  COALESCE(elem->>'name', 'Sauna'),
  COALESCE(elem->>'status', 'active'),
  COALESCE((elem->>'order')::int, ord - 1),
  NULLIF(elem->>'imageId', ''),
  NULLIF(elem->>'color', ''),
  NULLIF(elem->>'description', ''),
  COALESCE(elem->'info', '{}'::jsonb),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM active, jsonb_array_elements(active.data->'saunas') WITH ORDINALITY AS t(elem, ord)
WHERE jsonb_typeof(active.data->'saunas') = 'array'
ON CONFLICT ("id") DO NOTHING;

WITH active AS (
  SELECT data FROM settings
  WHERE "isActive" = true
  ORDER BY version DESC
  LIMIT 1
)
INSERT INTO "aromas" ("id", "name", "emoji", "color", "order", "createdAt", "updatedAt")
SELECT
  COALESCE(elem->>'id', 'aroma-' || ord::text),
  COALESCE(elem->>'name', 'Aroma'),
  COALESCE(elem->>'emoji', ''),
  NULLIF(elem->>'color', ''),
  ord::int - 1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM active, jsonb_array_elements(active.data->'aromas') WITH ORDINALITY AS t(elem, ord)
WHERE jsonb_typeof(active.data->'aromas') = 'array'
ON CONFLICT ("id") DO NOTHING;

WITH active AS (
  SELECT data FROM settings
  WHERE "isActive" = true
  ORDER BY version DESC
  LIMIT 1
)
INSERT INTO "info_items" ("id", "title", "text", "imageId", "imageMode", "order", "createdAt", "updatedAt")
SELECT
  COALESCE(elem->>'id', 'info-' || ord::text),
  COALESCE(elem->>'title', ''),
  COALESCE(elem->>'text', ''),
  NULLIF(elem->>'imageId', ''),
  NULLIF(elem->>'imageMode', ''),
  ord::int - 1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM active, jsonb_array_elements(active.data->'infos') WITH ORDINALITY AS t(elem, ord)
WHERE jsonb_typeof(active.data->'infos') = 'array'
ON CONFLICT ("id") DO NOTHING;

WITH active AS (
  SELECT data FROM settings
  WHERE "isActive" = true
  ORDER BY version DESC
  LIMIT 1
)
INSERT INTO "events" (
  "id", "name", "description", "imageId",
  "startDate", "startTime", "endDate", "endTime",
  "assignedPreset", "isActive", "targetDeviceIds", "slideshowId",
  "order", "createdAt", "updatedAt"
)
SELECT
  COALESCE(elem->>'id', 'event-' || ord::text),
  COALESCE(elem->>'name', 'Event'),
  NULLIF(elem->>'description', ''),
  NULLIF(elem->>'imageId', ''),
  COALESCE(elem->>'startDate', ''),
  COALESCE(elem->>'startTime', ''),
  NULLIF(elem->>'endDate', ''),
  NULLIF(elem->>'endTime', ''),
  COALESCE(elem->>'assignedPreset', 'Evt1'),
  COALESCE((elem->>'isActive')::boolean, true),
  CASE
    WHEN jsonb_typeof(elem->'targetDeviceIds') = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(elem->'targetDeviceIds'))
    ELSE ARRAY[]::TEXT[]
  END,
  -- Only keep slideshowId if it actually exists in the slideshows table.
  -- Dangling references would otherwise violate the FK constraint.
  CASE
    WHEN elem->>'slideshowId' IS NOT NULL
      AND elem->>'slideshowId' <> ''
      AND EXISTS (SELECT 1 FROM "slideshows" WHERE id = elem->>'slideshowId')
    THEN elem->>'slideshowId'
    ELSE NULL
  END,
  ord::int - 1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM active, jsonb_array_elements(active.data->'events') WITH ORDINALITY AS t(elem, ord)
WHERE jsonb_typeof(active.data->'events') = 'array'
ON CONFLICT ("id") DO NOTHING;
