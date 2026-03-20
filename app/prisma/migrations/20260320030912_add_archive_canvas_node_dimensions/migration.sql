-- AlterTable
ALTER TABLE "ArchivedCanvasNode"
ADD COLUMN "canvasHeight" DOUBLE PRECISION,
ADD COLUMN "canvasWidth" DOUBLE PRECISION;

UPDATE "ArchivedCanvasNode"
SET
  "canvasWidth" = CASE
    WHEN "kind" = 'note' THEN 420
    ELSE 360
  END,
  "canvasHeight" = CASE
    WHEN "kind" = 'note' THEN 300
    ELSE 280
  END
WHERE "canvasWidth" IS NULL OR "canvasHeight" IS NULL;

ALTER TABLE "ArchivedCanvasNode"
ALTER COLUMN "canvasHeight" SET NOT NULL,
ALTER COLUMN "canvasWidth" SET NOT NULL;
