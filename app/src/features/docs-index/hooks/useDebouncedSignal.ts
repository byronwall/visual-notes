import { createSignal, createEffect, onCleanup, type Accessor } from "solid-js";

export function useDebouncedSignal(
  src: Accessor<string>,
  { leadMs = 100, trailMs = 500 }: { leadMs?: number; trailMs?: number } = {}
) {
  const [val, setVal] = createSignal(src());
  let lead: number | undefined;
  let trail: number | undefined;

  createEffect(() => {
    const q = src();
    if (lead) clearTimeout(lead);
    if (trail) clearTimeout(trail);

    lead = window.setTimeout(() => setVal(q), leadMs);
    trail = window.setTimeout(() => setVal(q), trailMs);

    onCleanup(() => {
      if (lead) clearTimeout(lead);
      if (trail) clearTimeout(trail);
    });
  });

  return val;
}
