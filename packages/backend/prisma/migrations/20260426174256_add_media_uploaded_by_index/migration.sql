-- Index Media.uploadedBy so "media uploaded by user X" lookups don't full-scan.
CREATE INDEX IF NOT EXISTS "media_uploadedBy_idx" ON "media"("uploadedBy");
