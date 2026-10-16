import { revalidate } from "@solidjs/router";
import {
  fetchDocs,
  searchDocs,
  type DocListItem,
  type ServerSearchItem,
} from "~/features/docs-index/data/docs.service";

export type CommandSearchParams = {
  q: string;
  sortMode:
    | "relevance"
    | "recent_activity"
    | "most_viewed_30d"
    | "most_edited_30d";
  activityClass: "" | "READ_HEAVY" | "EDIT_HEAVY" | "BALANCED" | "COLD";
};

export type CommandSearchResult = {
  key: string;
  items: ServerSearchItem[];
  failed: boolean;
};

export const commandSearchKey = (params: CommandSearchParams) =>
  JSON.stringify([params.q, params.sortMode, params.activityClass]);

function searchArgs(params: CommandSearchParams) {
  return {
    q: params.q,
    take: 25,
    sortMode: params.sortMode,
    activityClass: params.activityClass || undefined,
  };
}

function feedArgs(params: CommandSearchParams) {
  return {
    take: 25,
    sortMode:
      params.sortMode === "relevance" ? "recent_activity" : params.sortMode,
    activityClass: params.activityClass || undefined,
  };
}

export async function retryCommandResults(
  params: CommandSearchParams,
  refetch: () => unknown,
) {
  const key = params.q
    ? searchDocs.keyFor(searchArgs(params))
    : fetchDocs.keyFor(feedArgs(params));
  await revalidate(key);
  refetch();
}

export async function loadCommandResults(
  params: CommandSearchParams,
): Promise<CommandSearchResult> {
  const key = commandSearchKey(params);

  try {
    if (params.q) {
      const docs = await searchDocs(searchArgs(params));
      if (!Array.isArray(docs))
        throw new TypeError("Search returned invalid results");
      return { key, items: docs as ServerSearchItem[], failed: false };
    }

    const docs = await fetchDocs(feedArgs(params));
    if (!Array.isArray(docs))
      throw new TypeError("Search returned invalid results");

    return {
      key,
      items: docs.map(
        (doc: DocListItem): ServerSearchItem => ({
          ...doc,
          snippet: undefined,
        }),
      ),
      failed: false,
    };
  } catch {
    return { key, items: [], failed: true };
  }
}
