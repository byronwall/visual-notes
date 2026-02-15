import { batch, createEffect } from "solid-js";
import { type DocsQueryStore } from "../state/docsQuery";

const MANAGED_KEYS = [
  "q",
  "pathPrefix",
  "pathBlankOnly",
  "metaKey",
  "metaValue",
  "source",
  "originalContentId",
  "createdFrom",
  "createdTo",
  "updatedFrom",
  "updatedTo",
  "activityClass",
  "sortMode",
  "clientShown",
  "serverShown",
];

type SearchParamsSetter = (
  params: Record<string, string | undefined>,
  options?: { replace?: boolean },
) => void;

export const useDocsIndexUrlSync = (args: {
  q: DocsQueryStore;
  searchParams: Record<string, string | string[] | undefined>;
  setSearchParams: SearchParamsSetter;
}) => {
  let initializedFromUrl = false;
  let lastSearchSnapshot = "";
  let lastStoreSearchSnapshot = "";
  let isFirstUrlSync = true;
  let syncingFromUrl = false;
  let syncingToUrl = false;

  const readParam = (key: string) => {
    const value = args.searchParams[key];
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value[0] || "";
    return "";
  };

  const buildManagedSearch = () => {
    const params = new URLSearchParams();
    for (const key of MANAGED_KEYS) {
      const value = readParam(key);
      if (value) params.set(key, value);
    }
    return params;
  };

  const parseParamsIntoStore = (sp: URLSearchParams) => {
    const qp = (key: string) => sp.get(key) || "";
    const num = (key: string, def: number) => {
      const v = Number(sp.get(key));
      return Number.isFinite(v) && v > 0 ? v : def;
    };
    const parseSortMode = (
      value: string,
    ):
      | "relevance"
      | "recent_activity"
      | "most_viewed_30d"
      | "most_edited_30d" => {
      if (
        value === "recent_activity" ||
        value === "most_viewed_30d" ||
        value === "most_edited_30d"
      ) {
        return value;
      }
      return "relevance";
    };

    const next = {
      searchText: qp("q"),
      pathPrefix: qp("pathPrefix"),
      blankPathOnly: (() => {
        const v = qp("pathBlankOnly").toLowerCase();
        return v === "1" || v === "true";
      })(),
      metaKey: qp("metaKey"),
      metaValue: qp("metaValue"),
      source: qp("source"),
      originalContentId: qp("originalContentId"),
      createdFrom: qp("createdFrom"),
      createdTo: qp("createdTo"),
      updatedFrom: qp("updatedFrom"),
      updatedTo: qp("updatedTo"),
      activityClass: qp("activityClass"),
      sortMode: parseSortMode(qp("sortMode")),
      clientShown: num("clientShown", 100),
      serverShown: num("serverShown", 25),
    };

    const desiredClient = Math.max(100, next.clientShown);
    const desiredServer = Math.max(25, next.serverShown);

    batch(() => {
      if (args.q.searchText() !== next.searchText) args.q.setSearchText(next.searchText);
      if (args.q.pathPrefix() !== next.pathPrefix) args.q.setPathPrefix(next.pathPrefix);
      if (args.q.blankPathOnly() !== next.blankPathOnly) {
        args.q.setBlankPathOnly(next.blankPathOnly);
      }
      if (args.q.metaKey() !== next.metaKey) args.q.setMetaKey(next.metaKey);
      if (args.q.metaValue() !== next.metaValue) args.q.setMetaValue(next.metaValue);
      if (args.q.source() !== next.source) args.q.setSource(next.source);
      if (args.q.originalContentId() !== next.originalContentId) {
        args.q.setOriginalContentId(next.originalContentId);
      }
      if (args.q.createdFrom() !== next.createdFrom) {
        args.q.setCreatedFrom(next.createdFrom || undefined);
      }
      if (args.q.createdTo() !== next.createdTo) {
        args.q.setCreatedTo(next.createdTo || undefined);
      }
      if (args.q.updatedFrom() !== next.updatedFrom) {
        args.q.setUpdatedFrom(next.updatedFrom || undefined);
      }
      if (args.q.updatedTo() !== next.updatedTo) {
        args.q.setUpdatedTo(next.updatedTo || undefined);
      }
      if (args.q.activityClass() !== next.activityClass) {
        args.q.setActivityClass(next.activityClass);
      }
      if (args.q.sortMode() !== next.sortMode) args.q.setSortMode(next.sortMode);
      if (args.q.clientShown() !== desiredClient) args.q.setClientShown(desiredClient);
      if (args.q.serverShown() !== desiredServer) args.q.setServerShown(desiredServer);
    });
  };

  createEffect(() => {
    if (syncingToUrl) {
      syncingToUrl = false;
      return;
    }
    const currentParams = buildManagedSearch();
    const currentSearch = currentParams.toString()
      ? `?${currentParams.toString()}`
      : "";
    if (isFirstUrlSync || currentSearch !== lastSearchSnapshot) {
      lastSearchSnapshot = currentSearch;
      isFirstUrlSync = false;
      syncingFromUrl = true;
      try {
        parseParamsIntoStore(currentParams);
      } finally {
        syncingFromUrl = false;
      }
      lastStoreSearchSnapshot = currentSearch;
      initializedFromUrl = true;
    }
  });

  createEffect(() => {
    if (!initializedFromUrl) return;
    if (syncingFromUrl) return;
    const params = new URLSearchParams();
    if (args.q.searchText().trim()) params.set("q", args.q.searchText().trim());
    if (args.q.pathPrefix().trim()) params.set("pathPrefix", args.q.pathPrefix().trim());
    if (args.q.blankPathOnly()) params.set("pathBlankOnly", "1");
    if (args.q.metaKey().trim()) params.set("metaKey", args.q.metaKey().trim());
    if (args.q.metaValue().trim()) params.set("metaValue", args.q.metaValue().trim());
    if (args.q.source().trim()) params.set("source", args.q.source().trim());
    if (args.q.originalContentId().trim()) {
      params.set("originalContentId", args.q.originalContentId().trim());
    }
    if (args.q.createdFrom().trim()) params.set("createdFrom", args.q.createdFrom().trim());
    if (args.q.createdTo().trim()) params.set("createdTo", args.q.createdTo().trim());
    if (args.q.updatedFrom().trim()) params.set("updatedFrom", args.q.updatedFrom().trim());
    if (args.q.updatedTo().trim()) params.set("updatedTo", args.q.updatedTo().trim());
    if (args.q.activityClass().trim()) params.set("activityClass", args.q.activityClass().trim());
    if (args.q.sortMode() !== "relevance") params.set("sortMode", args.q.sortMode());
    if (args.q.clientShown() !== 100) params.set("clientShown", String(args.q.clientShown()));
    if (args.q.serverShown() !== 25) params.set("serverShown", String(args.q.serverShown()));

    const nextSearch = params.toString() ? `?${params.toString()}` : "";
    if (nextSearch === lastStoreSearchSnapshot) return;
    if (nextSearch !== lastSearchSnapshot) {
      const obj: Record<string, string | undefined> = {};
      for (const k of MANAGED_KEYS) obj[k] = undefined;
      for (const [k, v] of params.entries()) obj[k] = v;
      lastSearchSnapshot = nextSearch;
      lastStoreSearchSnapshot = nextSearch;
      syncingToUrl = true;
      args.setSearchParams(obj, { replace: true });
    }
  });
};
