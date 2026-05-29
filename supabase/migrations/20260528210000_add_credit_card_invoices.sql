-- Credit-card / invoice feature: brings DB up to prisma/schema.prisma.
-- Written idempotently so re-runs are safe.

-- Enum: InvoiceStatus
DO $$ BEGIN
  CREATE TYPE "InvoiceStatus" AS ENUM ('OPEN', 'CLOSED', 'PAID', 'PARTIAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Account: credit-card-specific fields
ALTER TABLE "Account"
  ADD COLUMN IF NOT EXISTS "creditLimit" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "closingDay" INTEGER,
  ADD COLUMN IF NOT EXISTS "dueDay" INTEGER,
  ADD COLUMN IF NOT EXISTS "lastFour" TEXT,
  ADD COLUMN IF NOT EXISTS "brand" TEXT,
  ADD COLUMN IF NOT EXISTS "creditLimitUpdatedAt" TIMESTAMP(3);

-- Statement: cached raw extraction
ALTER TABLE "Statement"
  ADD COLUMN IF NOT EXISTS "extractedJson" JSONB;

-- Transaction: installments + invoice link
ALTER TABLE "Transaction"
  ADD COLUMN IF NOT EXISTS "installmentNumber" INTEGER,
  ADD COLUMN IF NOT EXISTS "installmentTotal" INTEGER,
  ADD COLUMN IF NOT EXISTS "installmentGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "invoiceId" TEXT;
CREATE INDEX IF NOT EXISTS "Transaction_installmentGroupId_idx" ON "Transaction" ("installmentGroupId");
CREATE INDEX IF NOT EXISTS "Transaction_invoiceId_idx" ON "Transaction" ("invoiceId");

-- CreditCardInvoice table
CREATE TABLE IF NOT EXISTS "CreditCardInvoice" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "referenceMonth" INTEGER NOT NULL,
  "referenceYear" INTEGER NOT NULL,
  "closingDate" TIMESTAMP(3),
  "dueDate" TIMESTAMP(3),
  "totalAmount" DOUBLE PRECISION,
  "minimumPayment" DOUBLE PRECISION,
  "previousBalance" DOUBLE PRECISION,
  "paymentsReceived" DOUBLE PRECISION,
  "paidAmount" DOUBLE PRECISION,
  "creditLimitSnapshot" DOUBLE PRECISION,
  "availableLimitSnapshot" DOUBLE PRECISION,
  "status" "InvoiceStatus" NOT NULL DEFAULT 'OPEN',
  "paidAt" TIMESTAMP(3),
  "statementId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CreditCardInvoice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CreditCardInvoice_accountId_referenceMonth_referenceYear_key"
  ON "CreditCardInvoice" ("accountId", "referenceMonth", "referenceYear");
CREATE INDEX IF NOT EXISTS "CreditCardInvoice_accountId_idx" ON "CreditCardInvoice" ("accountId");
CREATE INDEX IF NOT EXISTS "CreditCardInvoice_status_idx" ON "CreditCardInvoice" ("status");

-- Foreign keys (guarded: pg has no ADD CONSTRAINT IF NOT EXISTS)
DO $$ BEGIN
  ALTER TABLE "CreditCardInvoice"
    ADD CONSTRAINT "CreditCardInvoice_accountId_fkey" FOREIGN KEY ("accountId")
    REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CreditCardInvoice"
    ADD CONSTRAINT "CreditCardInvoice_statementId_fkey" FOREIGN KEY ("statementId")
    REFERENCES "Statement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Transaction"
    ADD CONSTRAINT "Transaction_invoiceId_fkey" FOREIGN KEY ("invoiceId")
    REFERENCES "CreditCardInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
