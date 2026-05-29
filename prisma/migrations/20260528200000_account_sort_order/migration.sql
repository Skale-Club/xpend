-- AlterTable: add manual sort order for accounts
ALTER TABLE "Account" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- Backfill: preserve the current display order (createdAt desc) as the initial sort order
WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt" DESC) - 1 AS rn
  FROM "Account"
)
UPDATE "Account" a
SET "sortOrder" = ranked.rn
FROM ranked
WHERE a."id" = ranked."id";
