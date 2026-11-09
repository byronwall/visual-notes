import { query } from "@solidjs/router";
import * as store from "~/server/pathways/pathway-store";
import { withLinkedStatus } from "~/server/pathways/pathway-tasks";

// Keys start with "pathway" so live updates (APP_LIVE_QUERY_KEYS.pathways)
// refresh them when an agent or another tab writes.

export const fetchPathways = query(async () => {
  "use server";
  return store.listPathways();
}, "pathways-list");

export const fetchPathway = query(async (id: string) => {
  "use server";
  const p = await store.getPathway(id);
  return p ? withLinkedStatus(p) : null;
}, "pathway-get");
