import { createContext, useContext, type JSX } from "solid-js";
import type { CollectionStore } from "./store/createCollectionStore";

type CollectionContextValue = {
  store: CollectionStore;
  /** Opens a row in the peek panel. */
  openRow: (rowId: string) => void;
  /** True inside a note embed, where page-only controls are hidden. */
  embedded: boolean;
};

const Ctx = createContext<CollectionContextValue>();

export const CollectionProvider = (props: CollectionContextValue & { children: JSX.Element }) => (
  <Ctx.Provider
    value={{
      get store() {
        return props.store;
      },
      openRow: (id) => props.openRow(id),
      get embedded() {
        return props.embedded;
      },
    }}
  >
    {props.children}
  </Ctx.Provider>
);

export const useCollection = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCollection must be used inside CollectionProvider");
  return ctx;
};
