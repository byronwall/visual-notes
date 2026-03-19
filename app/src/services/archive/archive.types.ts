export type ArchiveMetaRecord = Record<string, unknown>;

export type ArchivedPageCanvasCardMode = "compact" | "summary" | "rich";

export type ArchivedPageListItem = {
  id: string;
  title: string;
  originalUrl: string;
  normalizedUrl: string;
  siteHostname: string | null;
  groupName: string | null;
  lastCapturedAt: string | null;
  previewImageUrl: string | null;
  previewImageUrls: string[];
  faviconUrl: string | null;
  description: string | null;
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
  htmlSizeBytes: number | null;
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
  preferredImageUrls: string[];
  socialPreviewImageUrl: string | null;
  faviconUrl: string | null;
  description: string | null;
  meta: ArchiveMetaRecord | null;
  htmlSnippet: string;
  latestSnapshotId: string | null;
  latestSnapshotHtmlSizeBytes: number | null;
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

export type ArchivedPageGroupSummary = {
  name: string;
  count: number;
  lastCapturedAt: string | null;
};

export type ArchivedPageCanvasItem = {
  id: string;
  title: string;
  originalUrl: string;
  groupName: string;
  siteHostname: string | null;
  faviconUrl: string | null;
  metaDescription: string | null;
  noteSnippets: string[];
  description: string | null;
  descriptionSource: "meta" | "note" | null;
  preferredImages: string[];
  canvasX: number;
  canvasY: number;
  canvasCardMode: ArchivedPageCanvasCardMode;
  hasPersistedPosition: boolean;
  updatedAt: string;
};

export type ArchivedPageCanvasOverviewGroup = {
  name: string;
  count: number;
  latestUpdatedAt: string | null;
  previewImages: string[];
  sampleTitles: string[];
};

export type ArchiveAdminSnapshotItem = {
  id: string;
  archivedPageId: string;
  pageTitle: string;
  originalUrl: string;
  groupName: string | null;
  captureMode: "bulk" | "targeted";
  capturedAt: string;
  htmlPath: string | null;
  htmlSizeBytes: number | null;
  htmlHash: string | null;
  textSnippet: string | null;
};

export type ArchiveAdminSnapshotDetail = ArchiveAdminSnapshotItem & {
  meta: ArchiveMetaRecord | null;
};
