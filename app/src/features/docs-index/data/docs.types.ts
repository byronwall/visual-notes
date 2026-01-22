export type MetaRecord = Record<string, string | number | boolean | null>;

export type DocListItem = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  path?: string | null;
  meta?: MetaRecord | null;
};

export type ServerSearchItem = DocListItem & { snippet?: string | null };

export type SourcesResponse = {
  total: number;
  sources: { originalSource: string; count: number }[];
};

export type ScanRelativeImagesResult = {
  ok: boolean;
  total: number;
  considered: number;
  matches: number;
  updated?: number;
  failed?: number;
  dryRun?: boolean;
  readFailures?: number;
};

export type BulkMetaAction =
  | { type: "add"; key: string; value: string | number | boolean | null }
  | { type: "update"; key: string; value: string | number | boolean | null }
  | { type: "remove"; key: string };
