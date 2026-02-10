export type InlineImageMigrationStatus = {
  totalDocs: number;
  docsWithInlineDataImages: number;
  docsWithBackup: number;
  docsWithBackupAndStillInlineDataImages: number;
  docsRewrittenToDiskUrls: number;
  storageDir: string;
  recentBackups: Array<{
    id: string;
    title: string;
    updatedAt: string;
    path?: string | null;
    meta?: Record<string, unknown> | null;
    previewDoc?: {
      markdown?: string | null;
      html?: string | null;
      path?: string | null;
      meta?: Record<string, unknown> | null;
    } | null;
  }>;
  imageStorage: {
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
