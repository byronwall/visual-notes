-- CreateTable
CREATE TABLE "AnnotationType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "forAi" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "builtIn" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnotationType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Annotation" (
    "id" TEXT NOT NULL,
    "docId" TEXT,
    "typeId" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "author" TEXT NOT NULL DEFAULT 'you',
    "blockId" TEXT,
    "quote" TEXT,
    "quoteStart" INTEGER,
    "detachedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Annotation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnnotationType_name_key" ON "AnnotationType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AnnotationType_builtIn_key" ON "AnnotationType"("builtIn");

-- CreateIndex
CREATE INDEX "Annotation_docId_idx" ON "Annotation"("docId");

-- CreateIndex
CREATE INDEX "Annotation_typeId_idx" ON "Annotation"("typeId");

-- AddForeignKey
ALTER TABLE "Annotation" ADD CONSTRAINT "Annotation_docId_fkey" FOREIGN KEY ("docId") REFERENCES "Doc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Annotation" ADD CONSTRAINT "Annotation_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "AnnotationType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
