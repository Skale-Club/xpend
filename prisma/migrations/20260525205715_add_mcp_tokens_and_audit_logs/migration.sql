-- CreateTable
CREATE TABLE "McpToken" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenPreview" TEXT NOT NULL,
    "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "McpToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "McpAuditLog" (
    "id" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "paramsJson" TEXT,
    "outcome" TEXT NOT NULL,
    "errorCode" TEXT,
    "durationMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "McpAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "McpToken_tokenHash_key" ON "McpToken"("tokenHash");

-- CreateIndex
CREATE INDEX "McpToken_isActive_idx" ON "McpToken"("isActive");

-- CreateIndex
CREATE INDEX "McpAuditLog_tokenId_idx" ON "McpAuditLog"("tokenId");

-- CreateIndex
CREATE INDEX "McpAuditLog_createdAt_idx" ON "McpAuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "McpAuditLog" ADD CONSTRAINT "McpAuditLog_tokenId_fkey"
    FOREIGN KEY ("tokenId") REFERENCES "McpToken"("id") ON DELETE CASCADE ON UPDATE CASCADE;
