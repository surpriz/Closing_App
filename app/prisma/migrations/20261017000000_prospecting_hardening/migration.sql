-- AlterEnum
ALTER TYPE "OptOutKind" ADD VALUE 'PERSON';

-- CreateIndex
CREATE INDEX "prospect_suggestions_runId_idx" ON "prospect_suggestions"("runId");

-- CreateIndex
CREATE INDEX "prospecting_credit_entries_suggestionId_idx" ON "prospecting_credit_entries"("suggestionId");

