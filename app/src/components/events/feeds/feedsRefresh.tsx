import {
  createContext,
  createSignal,
  useContext,
  type Accessor,
  type JSX,
} from "solid-js";

// Feed actions revalidate the query cache; resources keyed on `version`
// re-run their query so every feed view updates together.
type FeedsRefresh = { version: Accessor<number>; bump: () => void };

const FeedsRefreshContext = createContext<FeedsRefresh>();

const createRefresh = (): FeedsRefresh => {
  const [version, setVersion] = createSignal(0);
  return { version, bump: () => setVersion((n) => n + 1) };
};

export function FeedsRefreshProvider(props: { children: JSX.Element }) {
  return (
    <FeedsRefreshContext.Provider value={createRefresh()}>
      {props.children}
    </FeedsRefreshContext.Provider>
  );
}

/** Shared refresh when inside a provider; a local one otherwise. */
export const useFeedsRefresh = () =>
  useContext(FeedsRefreshContext) ?? createRefresh();
