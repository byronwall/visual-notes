export type ActionEventItem = {
  id: string;
  createdAt: string;
  eventType: string;
  actorId?: string | null;
  actorType: "magic_user" | "anonymous" | "system" | "chatgpt";
  entityType: string;
  entityId?: string | null;
  relatedDocId?: string | null;
  relatedDocTitle?: string | null;
  relatedDocPath?: string | null;
  /** Groups events from one unit of work, such as one MCP tool call. */
  requestId?: string | null;
  payload?: Record<string, unknown> | null;
};

export type ActivityTimelineFilter = {
  take?: number;
  cursor?: string;
  eventType?: string;
  /** Event family prefix such as "doc" or "search" (matches "doc.*"). */
  eventDomain?: string;
  entityType?: string;
  entityId?: string;
  actorId?: string;
  relatedDocId?: string;
  docPathPrefix?: string;
  /** Events from one unit of work, such as everything one MCP call changed. */
  requestId?: string;
  /** Families left out of an unfiltered list, such as "mcp" (very chatty). */
  excludeDomains?: string[];
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

/** Connector use over a window, for the Activity page's MCP section. */
export type McpActivitySummary = {
  days: number;
  calls: number;
  /** Refused, failed, or denied calls. */
  problems: number;
  toolCount: number;
  clients: {
    actorId: string;
    /** The OAuth client's registered name, or its actor id. */
    name: string;
    calls: number;
    problems: number;
    lastCallAt: string | null;
    /** Has a live (unrevoked) OAuth grant. */
    connected: boolean;
  }[];
  /** Busiest tools first. */
  tools: { tool: string; calls: number; problems: number }[];
};
