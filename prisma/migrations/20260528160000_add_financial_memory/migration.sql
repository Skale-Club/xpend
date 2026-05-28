-- CreateTable
CREATE TABLE "FinancialJourney" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'My Financial Journey',
    "status" TEXT NOT NULL DEFAULT 'active',
    "summary" TEXT,
    "currentFocus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialJourney_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourneyEntry" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "entryType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "sourceSessionId" TEXT,
    "relatedGoalId" TEXT,
    "relatedPlanId" TEXT,
    "relatedTransactionId" TEXT,
    "relatedAccountId" TEXT,
    "importance" TEXT NOT NULL DEFAULT 'medium',
    "confidence" DOUBLE PRECISION,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "happenedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JourneyEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationMemory" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'chat',
    "title" TEXT,
    "rawSummary" TEXT,
    "structuredSummaryJson" TEXT,
    "keyDecisionsJson" TEXT,
    "assumptionsJson" TEXT,
    "nextStepsJson" TEXT,
    "relatedGoalIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "relatedPlanIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialMemory" (
    "id" TEXT NOT NULL,
    "memoryType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "normalizedContent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "sourceSessionId" TEXT,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "confidence" DOUBLE PRECISION,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "supersededById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryLink" (
    "id" TEXT NOT NULL,
    "memoryId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "relationshipType" TEXT NOT NULL DEFAULT 'relates_to',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemoryLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryReviewQueue" (
    "id" TEXT NOT NULL,
    "proposedMemoryType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "extractedFromSessionId" TEXT,
    "confidence" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "MemoryReviewQueue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JourneyEntry_journeyId_idx" ON "JourneyEntry"("journeyId");

-- CreateIndex
CREATE INDEX "JourneyEntry_entryType_idx" ON "JourneyEntry"("entryType");

-- CreateIndex
CREATE INDEX "JourneyEntry_happenedAt_idx" ON "JourneyEntry"("happenedAt");

-- CreateIndex
CREATE INDEX "ConversationMemory_sessionId_idx" ON "ConversationMemory"("sessionId");

-- CreateIndex
CREATE INDEX "FinancialMemory_memoryType_idx" ON "FinancialMemory"("memoryType");

-- CreateIndex
CREATE INDEX "FinancialMemory_status_idx" ON "FinancialMemory"("status");

-- CreateIndex
CREATE INDEX "FinancialMemory_relatedEntityType_relatedEntityId_idx" ON "FinancialMemory"("relatedEntityType", "relatedEntityId");

-- CreateIndex
CREATE INDEX "MemoryLink_memoryId_idx" ON "MemoryLink"("memoryId");

-- CreateIndex
CREATE INDEX "MemoryLink_entityType_entityId_idx" ON "MemoryLink"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "MemoryReviewQueue_status_idx" ON "MemoryReviewQueue"("status");

-- AddForeignKey
ALTER TABLE "JourneyEntry" ADD CONSTRAINT "JourneyEntry_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "FinancialJourney"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialMemory" ADD CONSTRAINT "FinancialMemory_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "FinancialMemory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryLink" ADD CONSTRAINT "MemoryLink_memoryId_fkey" FOREIGN KEY ("memoryId") REFERENCES "FinancialMemory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
