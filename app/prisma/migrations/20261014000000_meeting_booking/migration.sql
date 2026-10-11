-- AlterEnum
ALTER TYPE "ProspectActionType" ADD VALUE 'MEETING_CLICK';
ALTER TYPE "ProspectActionType" ADD VALUE 'MEETING_BOOKED';

-- AlterEnum
ALTER TYPE "SellerAlertType" ADD VALUE 'MEETING_BOOKED';

-- AlterTable
ALTER TABLE "links" ADD COLUMN     "bookingUrl" TEXT,
ADD COLUMN     "meetingBookedAt" TIMESTAMP(3),
ADD COLUMN     "meetingAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "notification_preferences" ADD COLUMN     "bookingUrl" TEXT;
