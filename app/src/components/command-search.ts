import { revalidate } from "@solidjs/router";
import {
  fetchDocs,
  searchDocs,
  type DocListItem,
  type ServerSearchItem,
} from "~/features/docs-index/data/docs.service";
import {
  searchPaletteGroups,
  type PaletteGroups,
} from "~/components/command-palette/palette-search.queries";

export type CommandSearchParams = {
  q: string;
  sortMode:
    | "relevance"
    | "recent_activity"
    | "most_viewed_30d"
    | "most_edited_30d";
  activityClass: "" | "READ_HEAVY" | "EDIT_HEAVY" | "BALANCED" | "COLD";
};

export type CommandSearchResult = PaletteGroups & {
  key: string;
  items: ServerSearchItem[];
  failed: boolean;
};

const NO_GROUPS: PaletteGroups = { tasks: [], topics: [], pages: [] };

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
  if (params.q) {
    await revalidate([
      searchDocs.keyFor(searchArgs(params)),
      searchPaletteGroups.keyFor(params.q),
    ]);
  } else {
    await revalidate(fetchDocs.keyFor(feedArgs(params)));
  }
  refetch();
}

export async function loadCommandResults(
  params: CommandSearchParams,
): Promise<CommandSearchResult> {
  const key = commandSearchKey(params);

  try {
    if (params.q) {
      // The note filter does not apply to the other kinds, so they step aside.
      const [docs, groups] = await Promise.all([
        searchDocs(searchArgs(params)),
        params.activityClass ? NO_GROUPS : searchPaletteGroups(params.q),
      ]);
      if (!Array.isArray(docs))
        throw new TypeError("Search returned invalid results");
      return { ...groups, key, items: docs as ServerSearchItem[], failed: false };
    }

    const docs = await fetchDocs(feedArgs(params));
    if (!Array.isArray(docs))
      throw new TypeError("Search returned invalid results");

    return {
      ...NO_GROUPS,
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
    return { ...NO_GROUPS, key, items: [], failed: true };
  }
}
