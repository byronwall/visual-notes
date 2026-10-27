-- CreateIndex
CREATE INDEX "Doc_audioText_idx" ON "Doc" USING GIN ("audioText" gin_trgm_ops);
