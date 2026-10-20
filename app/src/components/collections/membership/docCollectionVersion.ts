import { createSignal } from "solid-js";

// Note pages refetch their collection header when membership changes.
const [version, setVersion] = createSignal(0);
export const docCollectionVersion = version;
export const bumpDocCollection = () => setVersion((v) => v + 1);
