export type ActionEventItem = {
  id: string;
  createdAt: string;
  eventType: string;
  actorId?: string | null;
  actorType: "magic_user" | "anonymous" | "system";
  entityType: string;
  entityId?: string | null;
  relatedDocId?: string | null;
  relatedDocTitle?: string | null;
  relatedDocPath?: string | null;
  payload?: Record<string, unknown> | null;
};

export type ActivityTimelineFilter = {
  take?: number;
  cursor?: string;
  eventType?: string;
  entityType?: string;
  actorId?: string;
  relatedDocId?: string;
  docPathPrefix?: string;
  from?: string;
  to?: string;
};

export type DocActivitySummary = {
  docId: string;
  views30d: number;
  edits30d: number;
  searchClicks30d: number;
  lastViewedAt?: string | null;
  lastEditedAt?: string | null;
  lastInteractedAt?: string | null;
  activityClass: "READ_HEAVY" | "EDIT_HEAVY" | "BALANCED" | "COLD";
  updatedAt: string;
};

export type DocActivityHistory = {
  docId: string;
  generatedAt: string;
  viewCount: number;
  editCount: number;
  searchOpenedCount: number;
  lastViewBeforeThisOne?: string | null;
  events: ActionEventItem[];
};
