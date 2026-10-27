-- DropForeignKey
ALTER TABLE "campaigns" DROP CONSTRAINT "campaigns_mailboxId_fkey";

-- AlterTable
ALTER TABLE "campaigns" ALTER COLUMN "mailboxId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "mailboxes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

