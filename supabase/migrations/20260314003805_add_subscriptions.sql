-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY');

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logo" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "frequency" INTEGER NOT NULL DEFAULT 1,
    "nextPayment" TIMESTAMP(3) NOT NULL,
    "autoRenew" BOOLEAN NOT NULL DEFAULT true,
    "inactive" BOOLEAN NOT NULL DEFAULT false,
    "url" TEXT,
    "notes" TEXT,
    "categoryId" TEXT,
    "accountId" TEXT,
    "replacementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Subscription_nextPayment_idx" ON "Subscription"("nextPayment");

-- CreateIndex
CREATE INDEX "Subscription_inactive_idx" ON "Subscription"("inactive");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Enable RLS and add full access policy
ALTER TABLE public."Subscription" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dev_full_access" ON public."Subscription";
CREATE POLICY "dev_full_access"
ON public."Subscription"
FOR ALL
TO anon, authenticated, service_role
USING (true)
WITH CHECK (true);
