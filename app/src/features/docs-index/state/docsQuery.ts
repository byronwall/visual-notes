import { createStore } from "solid-js/store";
import type { SortMode } from "../data/docs.types";

export function createDocsQueryStore() {
  // Convert to a Solid store to group related state
  const [state, setState] = createStore({
    pathPrefix: "",
    blankPathOnly: false,
    metaKey: "",
    metaValue: "",
    searchText: "",
    source: "",
    originalContentId: "",
    createdFrom: "" as string,
    createdTo: "" as string,
    updatedFrom: "" as string,
    updatedTo: "" as string,
    activityClass: "",
    updatedWithinDays: 0,
    collectionRows: "" as "" | "all" | "only",
    collectionId: "",
    sortMode: "relevance" as SortMode,
    clientShown: 100,
    serverShown: 25,
  });

  // Plain accessors, not memos: store reads already track, and a server memo
  // computes once, so it would miss the URL state applied during setup.
  const pathPrefix = () => state.pathPrefix;
  const blankPathOnly = () => state.blankPathOnly;
  const metaKey = () => state.metaKey;
  const metaValue = () => state.metaValue;
  const searchText = () => state.searchText;
  const source = () => state.source;
  const originalContentId = () => state.originalContentId;
  const createdFrom = () => state.createdFrom;
  const createdTo = () => state.createdTo;
  const updatedFrom = () => state.updatedFrom;
  const updatedTo = () => state.updatedTo;
  const activityClass = () => state.activityClass;
  const updatedWithinDays = () => state.updatedWithinDays;
  const collectionRows = () => state.collectionRows;
  const collectionId = () => state.collectionId;
  const sortMode = () => state.sortMode;
  const clientShown = () => state.clientShown;
  const serverShown = () => state.serverShown;

  const setPathPrefix = (v: string) => setState("pathPrefix", v);
  const setBlankPathOnly = (v: boolean) => setState("blankPathOnly", v);
  const setMetaKey = (v: string) => setState("metaKey", v);
  const setMetaValue = (v: string) => setState("metaValue", v);
  const setSearchText = (v: string) => setState("searchText", v);
  const setSource = (v: string) => setState("source", v);
  const setOriginalContentId = (v: string) => setState("originalContentId", v);
  const setCreatedFrom = (v?: string) => setState("createdFrom", v ?? "");
  const setCreatedTo = (v?: string) => setState("createdTo", v ?? "");
  const setUpdatedFrom = (v?: string) => setState("updatedFrom", v ?? "");
  const setUpdatedTo = (v?: string) => setState("updatedTo", v ?? "");
  const setActivityClass = (v: string) => setState("activityClass", v);
  const setUpdatedWithinDays = (v: number) => setState("updatedWithinDays", v);
  const setCollectionRows = (v: string) =>
    setState("collectionRows", v === "all" || v === "only" ? v : "");
  const setCollectionId = (v: string) => setState("collectionId", v);
  const setSortMode = (v: SortMode) => setState("sortMode", v);

  const resetMeta = () => {
    setState({ metaKey: "", metaValue: "" });
  };
  // Showing every collection row is a view setting, not a filter, so clearing
  // filters keeps it.
  const resetFilters = () => {
    setState({
      pathPrefix: "",
      blankPathOnly: false,
      metaKey: "",
      metaValue: "",
      source: "",
      originalContentId: "",
      createdFrom: "",
      createdTo: "",
      updatedFrom: "",
      updatedTo: "",
      activityClass: "",
      updatedWithinDays: 0,
      collectionRows:
        state.collectionRows === "only" ? "" : state.collectionRows,
      collectionId: "",
    });
  };
  const hasFilters = () =>
    !!(
      state.pathPrefix.trim() ||
      state.blankPathOnly ||
      state.metaKey.trim() ||
      state.metaValue.trim() ||
      state.source.trim() ||
      state.originalContentId.trim() ||
      state.createdFrom ||
      state.createdTo ||
      state.updatedFrom ||
      state.updatedTo ||
      state.activityClass ||
      state.updatedWithinDays ||
      state.collectionRows === "only" ||
      state.collectionId
    );
  const resetPaging = () => {
    setState({ clientShown: 100, serverShown: 25 });
  };
  const showMoreClient = (n = 100) => setState("clientShown", (x) => x + n);
  const showMoreServer = (n = 25) => setState("serverShown", (x) => x + n);
  const setClientShown = (n: number) => setState("clientShown", Math.max(1, n));
  const setServerShown = (n: number) => setState("serverShown", Math.max(1, n));

  return {
    // Accessors
    pathPrefix,
    blankPathOnly,
    metaKey,
    metaValue,
    searchText,
    source,
    originalContentId,
    createdFrom,
    createdTo,
    updatedFrom,
    updatedTo,
    activityClass,
    updatedWithinDays,
    collectionRows,
    collectionId,
    sortMode,
    clientShown,
    serverShown,
    // Setters / actions
    setPathPrefix,
    setBlankPathOnly,
    setMetaKey,
    setMetaValue,
    setSearchText,
    setSource,
    setOriginalContentId,
    setCreatedFrom,
    setCreatedTo,
    setUpdatedFrom,
    setUpdatedTo,
    setActivityClass,
    setUpdatedWithinDays,
    setCollectionRows,
    setCollectionId,
    setSortMode,
    resetMeta,
    resetFilters,
    hasFilters,
    resetPaging,
    showMoreClient,
    showMoreServer,
    setClientShown,
    setServerShown,
  };
}

export type DocsQueryStore = ReturnType<typeof createDocsQueryStore>;
