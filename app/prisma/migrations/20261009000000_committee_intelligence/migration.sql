-- CreateEnum
CREATE TYPE "ProspectRole" AS ENUM ('DECISION_MAKER', 'FINANCE', 'TECHNICAL', 'CHAMPION', 'INFLUENCER', 'OTHER');

-- CreateEnum
CREATE TYPE "ProspectOrigin" AS ENUM ('SELLER', 'EMAIL_GATE');

-- AlterEnum
ALTER TYPE "SellerAlertType" ADD VALUE 'COMMITTEE_LIVE';
ALTER TYPE "SellerAlertType" ADD VALUE 'NEW_READER';
ALTER TYPE "SellerAlertType" ADD VALUE 'DECISION_MAKER_DETECTED';

-- AlterTable
ALTER TABLE "prospects" ADD COLUMN     "origin" "ProspectOrigin" NOT NULL DEFAULT 'SELLER',
ADD COLUMN     "role" "ProspectRole";

-- AlterTable
ALTER TABLE "workspace_settings" ADD COLUMN     "committeeThreshold" INTEGER NOT NULL DEFAULT 3;

