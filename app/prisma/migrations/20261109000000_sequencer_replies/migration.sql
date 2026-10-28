-- AlterEnum
ALTER TYPE "ActivitySource" ADD VALUE 'SEQUENCER';

-- AlterTable
ALTER TABLE "workspace_settings" ADD COLUMN     "sequencerTokenVersion" INTEGER NOT NULL DEFAULT 0;
