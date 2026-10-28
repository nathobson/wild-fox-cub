-- Uploaded images. Files live in R2 under media/<id>/: the original plus one
-- file per (width × format) listed in "widths", e.g. media/<id>/800.avif.
CREATE TABLE IF NOT EXISTS "media" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "filename" TEXT NOT NULL,
  "alt" TEXT NOT NULL DEFAULT '',
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "format" TEXT NOT NULL,
  "widths" TEXT NOT NULL,
  "fallback" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "createdAt" TEXT NOT NULL,
  "createdBy" TEXT
);
