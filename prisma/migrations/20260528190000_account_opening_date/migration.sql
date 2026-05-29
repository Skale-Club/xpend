-- AlterTable: add opening date columns
ALTER TABLE "Account" ADD COLUMN "openingMonth" INTEGER;
ALTER TABLE "Account" ADD COLUMN "openingYear" INTEGER;

-- Backfill: carry over the previous oldestYear value as the opening year
UPDATE "Account" SET "openingYear" = "oldestYear" WHERE "oldestYear" IS NOT NULL;

-- Drop the obsolete column
ALTER TABLE "Account" DROP COLUMN "oldestYear";
