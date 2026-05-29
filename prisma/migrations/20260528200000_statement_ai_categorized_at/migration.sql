-- Add nullable timestamp marking when a statement's transactions were categorized via the AI action.
ALTER TABLE "Statement" ADD COLUMN "aiCategorizedAt" TIMESTAMP(3);
