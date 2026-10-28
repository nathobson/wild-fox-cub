-- Fully rendered HTML for every published page, written at publish time.
-- "build" records which deploy rendered it, so a new deploy re-renders once.
CREATE TABLE IF NOT EXISTS "rendered_pages" (
  "slug" TEXT NOT NULL PRIMARY KEY,
  "html" TEXT NOT NULL,
  "status" INTEGER NOT NULL DEFAULT 200,
  "build" TEXT NOT NULL,
  "renderedAt" TEXT NOT NULL
);
