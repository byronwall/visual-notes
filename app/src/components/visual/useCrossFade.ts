import {
  createEffect,
  createSignal,
  onCleanup,
  untrack,
  type Accessor,
  type Setter,
} from "solid-js";

export type FadeEntry<T> = {
  key: string;
  item: Accessor<T>;
  visible: Accessor<boolean>;
};

type MutableEntry<T> = FadeEntry<T> & {
  setItem: Setter<T>;
  setVisible: Setter<boolean>;
  timer?: number;
};

/**
 * Keeps leaving items mounted for `fadeMs` so they can fade out, and mounts
 * entering items hidden for one frame so they can fade in. Entries keep
 * their identity per key, so `<For>` never remounts a label that stays.
 */
export function useCrossFade<T>(
  items: Accessor<T[]>,
  keyOf: (item: T) => string,
  fadeMs = 180,
): Accessor<FadeEntry<T>[]> {
  const entries = new Map<string, MutableEntry<T>>();
  const [list, setList] = createSignal<FadeEntry<T>[]>([]);
  const frames = new Set<number>();

  const publish = () => setList([...entries.values()]);

  createEffect(() => {
    const next = items();
    untrack(() => {
      const nextKeys = new Set<string>();
      const entering: MutableEntry<T>[] = [];
      for (const item of next) {
        const key = keyOf(item);
        nextKeys.add(key);
        const existing = entries.get(key);
        if (existing) {
          if (existing.timer !== undefined) {
            window.clearTimeout(existing.timer);
            existing.timer = undefined;
          }
          existing.setItem(() => item);
          existing.setVisible(true);
          continue;
        }
        const [itemSignal, setItem] = createSignal(item);
        const [visible, setVisible] = createSignal(false);
        const entry: MutableEntry<T> = {
          key,
          item: itemSignal,
          visible,
          setItem,
          setVisible,
        };
        entries.set(key, entry);
        entering.push(entry);
      }
      for (const [key, entry] of entries) {
        if (nextKeys.has(key) || entry.timer !== undefined) continue;
        entry.setVisible(false);
        entry.timer = window.setTimeout(() => {
          entries.delete(key);
          publish();
        }, fadeMs);
      }
      publish();
      if (entering.length > 0) {
        // Flip to visible after the hidden state has painted once.
        const outer = requestAnimationFrame(() => {
          frames.delete(outer);
          const inner = requestAnimationFrame(() => {
            frames.delete(inner);
            for (const entry of entering) {
              if (
                entries.get(entry.key) === entry &&
                entry.timer === undefined
              ) {
                entry.setVisible(true);
              }
            }
          });
          frames.add(inner);
        });
        frames.add(outer);
      }
    });
  });

  onCleanup(() => {
    for (const frame of frames) cancelAnimationFrame(frame);
    for (const entry of entries.values()) {
      if (entry.timer !== undefined) window.clearTimeout(entry.timer);
    }
  });

  return list;
}
