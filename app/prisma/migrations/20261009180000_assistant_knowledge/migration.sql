-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "assistantNotes" TEXT,
ADD COLUMN     "docTypeSource" "PageTagSource" NOT NULL DEFAULT 'AUTO';

-- AlterTable
ALTER TABLE "workspace_settings" ADD COLUMN     "assistantKnowledge" TEXT;
