export type RawNote = {
  id: string;
  title: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  folder: string;
  html?: string; // inline HTML (optional)
  filePath?: string; // path to HTML or MD file (optional)
};

export type ExportedNote = RawNote & { markdown: string };

export type SkipLog = {
  id: string;
  title: string;
  updatedAt: string;
  reason: string;
  sinceEpochSec?: number;
  prevUpdatedAt?: string;
};

export interface IngestSourceOptions {
  limit: number;
  verbose: boolean;
}

export interface IngestSource {
  name: "apple-notes" | "html-dir" | "notion-md";
  load(opts: IngestSourceOptions): Promise<{
    notes: RawNote[];
    meta?: Record<string, unknown>;
    skipLogs?: SkipLog[];
  }>;
}
