export type ArchiveMetaRecord = Record<string, unknown>;

export type ArchivedPageListItem = {
  id: string;
  title: string;
  originalUrl: string;
  normalizedUrl: string;
  siteHostname: string | null;
  groupName: string | null;
  lastCapturedAt: string | null;
  previewImageUrl: string | null;
  notesCount: number;
  snapshotsCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ArchivedPageNoteItem = {
  id: string;
  noteText: string;
  imageUrls: string[];
  sourceContext: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  snapshotId: string | null;
};

export type ArchivedPageSnapshotItem = {
  id: string;
  captureMode: "bulk" | "targeted";
  capturedAt: string;
  title: string | null;
  groupName: string | null;
  htmlPath: string | null;
  htmlHash: string | null;
  textSnippet: string | null;
  meta: ArchiveMetaRecord | null;
};

export type ArchivedPageDetail = {
  id: string;
  title: string;
  originalUrl: string;
  normalizedUrl: string;
  siteHostname: string | null;
  groupName: string | null;
  lastCapturedAt: string | null;
  previewImageUrl: string | null;
  socialPreviewImageUrl: string | null;
  meta: ArchiveMetaRecord | null;
  htmlSnippet: string;
  notes: ArchivedPageNoteItem[];
  snapshots: ArchivedPageSnapshotItem[];
  createdAt: string;
  updatedAt: string;
};

export type PageLookupResponse = {
  exists: boolean;
  pageId: string | null;
  title: string | null;
  groupName: string | null;
  lastCapturedAt: string | null;
};

export type ArchiveListFilters = {
  group?: string;
  hostname?: string;
  capturedFrom?: string;
  capturedTo?: string;
};
