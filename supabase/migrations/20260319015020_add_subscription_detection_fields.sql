-- Add auto-detection fields to Subscription table
ALTER TABLE "Subscription"
  ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS "matchPattern" TEXT,
  ADD COLUMN IF NOT EXISTS "lastSeenDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "firstSeenDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "occurrences" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "avgAmount" DOUBLE PRECISION;

-- Index for matching detected subscriptions by pattern
CREATE INDEX IF NOT EXISTS "Subscription_matchPattern_idx" ON "Subscription" ("matchPattern");
