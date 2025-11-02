import { createMemo } from "solid-js";
import { createStore } from "solid-js/store";

export function createDocsQueryStore() {
  // Convert to a Solid store to group related state
  const [state, setState] = createStore({
    pathPrefix: "",
    blankPathOnly: false,
    metaKey: "",
    metaValue: "",
    searchText: "",
    source: "",
    createdFrom: "" as string,
    createdTo: "" as string,
    updatedFrom: "" as string,
    updatedTo: "" as string,
    clientShown: 100,
    serverShown: 25,
  });

  // Accessors to preserve the existing function-based API
  const pathPrefix = createMemo(() => state.pathPrefix);
  const blankPathOnly = createMemo(() => state.blankPathOnly);
  const metaKey = createMemo(() => state.metaKey);
  const metaValue = createMemo(() => state.metaValue);
  const searchText = createMemo(() => state.searchText);
  const source = createMemo(() => state.source);
  const createdFrom = createMemo(() => state.createdFrom);
  const createdTo = createMemo(() => state.createdTo);
  const updatedFrom = createMemo(() => state.updatedFrom);
  const updatedTo = createMemo(() => state.updatedTo);
  const clientShown = createMemo(() => state.clientShown);
  const serverShown = createMemo(() => state.serverShown);

  const setPathPrefix = (v: string) => setState("pathPrefix", v);
  const setBlankPathOnly = (v: boolean) => setState("blankPathOnly", v);
  const setMetaKey = (v: string) => setState("metaKey", v);
  const setMetaValue = (v: string) => setState("metaValue", v);
  const setSearchText = (v: string) => setState("searchText", v);
  const setSource = (v: string) => setState("source", v);
  const setCreatedFrom = (v?: string) => setState("createdFrom", v ?? "");
  const setCreatedTo = (v?: string) => setState("createdTo", v ?? "");
  const setUpdatedFrom = (v?: string) => setState("updatedFrom", v ?? "");
  const setUpdatedTo = (v?: string) => setState("updatedTo", v ?? "");

  const resetMeta = () => {
    setState({ metaKey: "", metaValue: "" });
  };
  const resetDatesAndSource = () => {
    setState({
      source: "",
      createdFrom: "",
      createdTo: "",
      updatedFrom: "",
      updatedTo: "",
    });
  };
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
    createdFrom,
    createdTo,
    updatedFrom,
    updatedTo,
    clientShown,
    serverShown,
    // Setters / actions
    setPathPrefix,
    setBlankPathOnly,
    setMetaKey,
    setMetaValue,
    setSearchText,
    setSource,
    setCreatedFrom,
    setCreatedTo,
    setUpdatedFrom,
    setUpdatedTo,
    resetMeta,
    resetDatesAndSource,
    resetPaging,
    showMoreClient,
    showMoreServer,
    setClientShown,
    setServerShown,
  };
}

export type DocsQueryStore = ReturnType<typeof createDocsQueryStore>;
