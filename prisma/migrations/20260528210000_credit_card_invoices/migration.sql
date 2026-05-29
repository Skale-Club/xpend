-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('OPEN', 'CLOSED', 'PAID', 'PARTIAL');

-- AlterTable: Account credit-card fields (nullable, only used when type = CREDIT_CARD)
ALTER TABLE "Account" ADD COLUMN     "creditLimit" DOUBLE PRECISION,
ADD COLUMN     "closingDay" INTEGER,
ADD COLUMN     "dueDay" INTEGER,
ADD COLUMN     "lastFour" TEXT,
ADD COLUMN     "brand" TEXT,
ADD COLUMN     "creditLimitUpdatedAt" TIMESTAMP(3);

-- AlterTable: Statement cache of the AI-extracted fatura metadata block
ALTER TABLE "Statement" ADD COLUMN     "extractedJson" JSONB;

-- AlterTable: Transaction installment metadata + invoice link
ALTER TABLE "Transaction" ADD COLUMN     "installmentNumber" INTEGER,
ADD COLUMN     "installmentTotal" INTEGER,
ADD COLUMN     "installmentGroupId" TEXT,
ADD COLUMN     "invoiceId" TEXT;

-- CreateTable
CREATE TABLE "CreditCardInvoice" (
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

-- CreateIndex
CREATE INDEX "CreditCardInvoice_accountId_idx" ON "CreditCardInvoice"("accountId");

-- CreateIndex
CREATE INDEX "CreditCardInvoice_status_idx" ON "CreditCardInvoice"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CreditCardInvoice_accountId_referenceMonth_referenceYear_key" ON "CreditCardInvoice"("accountId", "referenceMonth", "referenceYear");

-- CreateIndex
CREATE INDEX "Transaction_installmentGroupId_idx" ON "Transaction"("installmentGroupId");

-- CreateIndex
CREATE INDEX "Transaction_invoiceId_idx" ON "Transaction"("invoiceId");

-- AddForeignKey
ALTER TABLE "CreditCardInvoice" ADD CONSTRAINT "CreditCardInvoice_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditCardInvoice" ADD CONSTRAINT "CreditCardInvoice_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "Statement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "CreditCardInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
