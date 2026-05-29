-- CreateTable
CREATE TABLE "ApiLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "level" TEXT NOT NULL DEFAULT 'INFO',
    "category" TEXT NOT NULL DEFAULT 'api',
    "method" TEXT,
    "path" TEXT,
    "status" INTEGER,
    "durationMs" INTEGER,
    "message" TEXT,
    "metadata" JSONB,
    "error" TEXT,
    "userEmail" TEXT,

    CONSTRAINT "ApiLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApiLog_createdAt_idx" ON "ApiLog"("createdAt");

-- CreateIndex
CREATE INDEX "ApiLog_level_idx" ON "ApiLog"("level");

-- CreateIndex
CREATE INDEX "ApiLog_category_idx" ON "ApiLog"("category");

-- CreateIndex
CREATE INDEX "ApiLog_path_idx" ON "ApiLog"("path");
