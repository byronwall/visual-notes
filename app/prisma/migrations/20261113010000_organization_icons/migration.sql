-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "iconCheckedAt" TIMESTAMP(3),
ADD COLUMN     "iconData" BYTEA,
ADD COLUMN     "iconType" TEXT;

