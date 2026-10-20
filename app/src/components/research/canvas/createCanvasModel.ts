import { createEffect, createMemo, createSignal, on, type Accessor } from "solid-js";
import { foldView, scaleForLevel } from "../layout/fold";
import { hullRect, layoutTree, type Rect } from "../layout/tree-layout";
import type { TopicData } from "../createTopicData";

/**
 * Fold + layout for the current level. Coarser levels are laid out larger
 * (factor k) so their summary cards read at normal size in that zoom band.
 */
export const createCanvasModel = (data: TopicData, level: Accessor<number>) => {
  // Optimistic nudges, keyed by card id, until the reloaded graph includes them.
  const [localNudges, setLocalNudges] = createSignal(new Map<string, { x: number; y: number } | null>());

  // A fresh graph carries the saved nudges; drop the optimistic copies.
  createEffect(on(data.cards, () => setLocalNudges(new Map()), { defer: true }));

  const view = createMemo(() =>
    foldView({
      cards: data.cards(),
      groups: data.current()?.groups ?? [],
      links: data.current()?.links ?? [],
      level: level(),
    }),
  );

  const nudges = createMemo(() => {
    const out = new Map<string, { x: number; y: number }>();
    for (const card of data.cards()) {
      if (card.nudgeX !== null || card.nudgeY !== null) out.set(card.id, { x: card.nudgeX ?? 0, y: card.nudgeY ?? 0 });
    }
    for (const [id, nudge] of localNudges()) {
      if (nudge) out.set(id, nudge);
      else out.delete(id);
    }
    return out;
  });

  const factor = createMemo(() => (level() <= 0 ? 1 : 1 / scaleForLevel(level())));

  const layout = createMemo(() => {
    const base = layoutTree(view(), nudges());
    const k = factor();
    const scale = (rect: Rect): Rect => ({ x: rect.x * k, y: rect.y * k, w: rect.w * k, h: rect.h * k });
    const rects = new Map([...base.rects].map(([id, rect]) => [id, scale(rect)]));
    const hulls = view()
      .hulls.map((hull) => {
        const rect = hullRect(hull, base.rects);
        return rect ? { hull, rect: scale(rect) } : null;
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
    return { rects, hulls, bounds: scale(base.bounds) };
  });

  const setLocalNudge = (id: string, nudge: { x: number; y: number } | null) =>
    setLocalNudges((prev) => new Map(prev).set(id, nudge));

  return { view, layout, factor, nudges, setLocalNudge };
};

export type CanvasModel = ReturnType<typeof createCanvasModel>;
