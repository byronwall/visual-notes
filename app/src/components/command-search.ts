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

export async function loadCommandResults(
  params: CommandSearchParams,
): Promise<CommandSearchResult> {
  const key = commandSearchKey(params);

  try {
    if (params.q) {
      const docs = await searchDocs({
        q: params.q,
        take: 25,
        sortMode: params.sortMode,
        activityClass: params.activityClass || undefined,
      });
      if (!Array.isArray(docs))
        throw new TypeError("Search returned invalid results");
      return { key, items: docs as ServerSearchItem[], failed: false };
    }

    const emptySortMode =
      params.sortMode === "relevance" ? "recent_activity" : params.sortMode;
    const docs = await fetchDocs({
      take: 25,
      sortMode: emptySortMode,
      activityClass: params.activityClass || undefined,
    });
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
