-- Drop the legacy `settings` JSON column from device_overrides.
-- Design/theme/slideshow customisation is now driven by SlideshowConfig and
-- reaches devices via `devices.slideshowId`. Device-level overrides are
-- scoped to the schedule only.

ALTER TABLE "device_overrides" DROP COLUMN IF EXISTS "settings";
