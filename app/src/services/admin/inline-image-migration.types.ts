export type InlineImageMigrationCountsStatus = {
  totalDocs: number;
  docsWithInlineDataImages: number;
  docsWithBackup: number;
  docsWithBackupAndStillInlineDataImages: number;
  docsRewrittenToDiskUrls: number;
  storageDir: string;
};

export type InlineImageMigrationRecentBackup = {
  id: string;
  title: string;
  updatedAt: string;
  path?: string | null;
  meta?: Record<string, unknown> | null;
  snippet?: string | null;
};

export type InlineImageMigrationImageStorageStatus = {
  storageDir: string;
  dirExists: boolean;
  fileCount: number;
  totalBytes: number;
  files: Array<{
    name: string;
    sizeBytes: number;
    updatedAt: string;
    url: string;
  }>;
};

export type InlineImageMigrationStatus = InlineImageMigrationCountsStatus & {
  recentBackups: InlineImageMigrationRecentBackup[];
  imageStorage: Omit<InlineImageMigrationImageStorageStatus, "storageDir">;
};

export type InlineImageMigrationBatchResult = {
  dryRun: boolean;
  limit: number;
  scanned: number;
  updatedDocs: number;
  migratedImageRefs: number;
  skippedDocs: number;
  failures: Array<{ docId: string; error: string }>;
};

export type HeicTranscodeBatchResult = {
  dryRun: boolean;
  limit: number;
  scanned: number;
  updatedDocs: number;
  transcodedImages: number;
  skippedDocs: number;
  failures: Array<{ docId: string; error: string }>;
};
