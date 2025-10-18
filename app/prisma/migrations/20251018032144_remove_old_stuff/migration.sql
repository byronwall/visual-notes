/*
  Warnings:

  - You are about to drop the column `passageId` on the `PromptRun` table. All the data in the column will be lost.
  - You are about to drop the `AiBookSummary` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AiSummary` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DayPassage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Passage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PassageCache` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Plan` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PlanDay` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ReadingProgress` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."AiSummary" DROP CONSTRAINT "AiSummary_passageId_fkey";

-- DropForeignKey
ALTER TABLE "public"."DayPassage" DROP CONSTRAINT "DayPassage_dayId_fkey";

-- DropForeignKey
ALTER TABLE "public"."DayPassage" DROP CONSTRAINT "DayPassage_passageId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Plan" DROP CONSTRAINT "Plan_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."PlanDay" DROP CONSTRAINT "PlanDay_planId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ReadingProgress" DROP CONSTRAINT "ReadingProgress_dayId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ReadingProgress" DROP CONSTRAINT "ReadingProgress_passageId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ReadingProgress" DROP CONSTRAINT "ReadingProgress_planId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ReadingProgress" DROP CONSTRAINT "ReadingProgress_userId_fkey";

-- AlterTable
ALTER TABLE "PromptRun" DROP COLUMN "passageId";

-- DropTable
DROP TABLE "public"."AiBookSummary";

-- DropTable
DROP TABLE "public"."AiSummary";

-- DropTable
DROP TABLE "public"."DayPassage";

-- DropTable
DROP TABLE "public"."Passage";

-- DropTable
DROP TABLE "public"."PassageCache";

-- DropTable
DROP TABLE "public"."Plan";

-- DropTable
DROP TABLE "public"."PlanDay";

-- DropTable
DROP TABLE "public"."ReadingProgress";
