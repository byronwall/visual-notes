import { query } from "@solidjs/router";
import * as store from "~/server/pathways/pathway-store";

// Keys start with "pathway" so live updates (APP_LIVE_QUERY_KEYS.pathways)
// refresh them when an agent or another tab writes.

export const fetchPathways = query(async () => {
  "use server";
  return store.listPathways();
}, "pathways-list");

export const fetchPathway = query(async (id: string) => {
  "use server";
  return store.getPathway(id);
}, "pathway-get");
