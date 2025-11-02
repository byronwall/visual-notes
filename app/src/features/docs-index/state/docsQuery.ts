import { createSignal } from "solid-js";

export function createDocsQueryStore() {
  // TODO: convert this over to a store
  const [pathPrefix, setPathPrefix] = createSignal("");
  const [metaKey, setMetaKey] = createSignal("");
  const [metaValue, setMetaValue] = createSignal("");
  const [searchText, setSearchText] = createSignal("");
  const [clientShown, setClientShown] = createSignal(100);
  const [serverShown, setServerShown] = createSignal(25);

  const resetMeta = () => {
    setMetaKey("");
    setMetaValue("");
  };
  const resetPaging = () => {
    setClientShown(100);
    setServerShown(25);
  };
  const showMoreClient = (n = 100) => setClientShown((x) => x + n);
  const showMoreServer = (n = 25) => setServerShown((x) => x + n);

  return {
    pathPrefix,
    setPathPrefix,
    metaKey,
    setMetaKey,
    metaValue,
    setMetaValue,
    searchText,
    setSearchText,
    clientShown,
    serverShown,
    resetMeta,
    resetPaging,
    showMoreClient,
    showMoreServer,
  };
}
