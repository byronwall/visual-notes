import { createMemo } from "solid-js";
import { createStore } from "solid-js/store";

export function createDocsQueryStore() {
  // Convert to a Solid store to group related state
  const [state, setState] = createStore({
    pathPrefix: "",
    metaKey: "",
    metaValue: "",
    searchText: "",
    clientShown: 100,
    serverShown: 25,
  });

  // Accessors to preserve the existing function-based API
  const pathPrefix = createMemo(() => state.pathPrefix);
  const metaKey = createMemo(() => state.metaKey);
  const metaValue = createMemo(() => state.metaValue);
  const searchText = createMemo(() => state.searchText);
  const clientShown = createMemo(() => state.clientShown);
  const serverShown = createMemo(() => state.serverShown);

  const setPathPrefix = (v: string) => setState("pathPrefix", v);
  const setMetaKey = (v: string) => setState("metaKey", v);
  const setMetaValue = (v: string) => setState("metaValue", v);
  const setSearchText = (v: string) => setState("searchText", v);

  const resetMeta = () => {
    setState({ metaKey: "", metaValue: "" });
  };
  const resetPaging = () => {
    setState({ clientShown: 100, serverShown: 25 });
  };
  const showMoreClient = (n = 100) => setState("clientShown", (x) => x + n);
  const showMoreServer = (n = 25) => setState("serverShown", (x) => x + n);

  return {
    // Accessors
    pathPrefix,
    metaKey,
    metaValue,
    searchText,
    clientShown,
    serverShown,
    // Setters / actions
    setPathPrefix,
    setMetaKey,
    setMetaValue,
    setSearchText,
    resetMeta,
    resetPaging,
    showMoreClient,
    showMoreServer,
  };
}
