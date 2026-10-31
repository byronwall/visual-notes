import { createEffect, createMemo, createSignal, on } from "solid-js";
import { plainExcerpt } from "../board/BoardCardRow";
import type { TopicData } from "../createTopicData";
import { layoutMap } from "./map-layout";
import { ancestorsOf, buildMapTree, type MapTree } from "./map-model";

/** A topic this small starts one level open; a bigger one starts folded. */
const SMALL_TOPIC = 12;

const branchIds = (tree: MapTree) =>
  [...tree.byId.values()].filter(
    (node) => node.children.length && node.kind !== "root",
  );

/** Which branches are open, and everything derived from it. Shared by the map and the phone tree. */
export const createMapState = (props: {
  data: () => TopicData;
  selectedId: () => string | null;
  selectedStream: () => string | null;
  matches: () => Set<string> | null;
}) => {
  const tree = createMemo(() =>
    buildMapTree(
      props.data().board(),
      props.data().cards(),
      props.data().current()?.topic.title ?? "",
      plainExcerpt(props.data().current()?.topic.answer ?? ""),
    ),
  );
  // A memo, so a live update that rebuilds the tree does not read as a new pick.
  const selectedNode = createMemo(() => {
    const card = props.selectedId();
    if (card) return tree().cardNodes.get(card) ?? null;
    const key = props.selectedStream();
    if (!key) return null;
    return (
      tree().root.children.find((node) => node.streamKey === key)?.id ?? null
    );
  });

  const initialOpen = () => {
    const next = new Set<string>();
    if (tree().root.counts.total <= SMALL_TOPIC)
      for (const stream of tree().root.children) next.add(stream.id);
    const picked = selectedNode();
    if (picked) for (const id of ancestorsOf(tree(), picked)) next.add(id);
    return next;
  };
  const [open, setOpen] = createSignal(initialOpen());

  // A card picked elsewhere (the reader's next, a share link) must be on the map.
  createEffect(
    on(
      selectedNode,
      (picked) => {
        if (!picked) return;
        const missing = ancestorsOf(tree(), picked).filter(
          (id) => !open().has(id),
        );
        if (missing.length) setOpen((prev) => new Set([...prev, ...missing]));
      },
      { defer: true },
    ),
  );

  /** Node ids that hold a match, with how many. Null without a search. */
  const matchCounts = createMemo(() => {
    const matches = props.matches();
    if (!matches) return null;
    const counts = new Map<string, number>();
    for (const cardId of matches) {
      const id = tree().cardNodes.get(cardId);
      if (!id) continue;
      for (const at of [...ancestorsOf(tree(), id), id])
        counts.set(at, (counts.get(at) ?? 0) + 1);
    }
    return counts;
  });

  // A search opens what it needs without losing the branches you opened.
  const searchOpen = createMemo(() => {
    const forced = new Set<string>();
    for (const cardId of props.matches() ?? []) {
      const id = tree().cardNodes.get(cardId);
      if (id) for (const at of ancestorsOf(tree(), id)) forced.add(at);
    }
    return forced;
  });
  const openIds = createMemo(() => new Set([...open(), ...searchOpen()]));

  const layout = createMemo(() => layoutMap(tree(), openIds()));

  /** The path from the root to the selection, for the accent connector. */
  const selectedPath = createMemo(() => {
    const picked = selectedNode();
    return new Set(picked ? [...ancestorsOf(tree(), picked), picked] : []);
  });

  const isDimmed = (id: string) => {
    const counts = matchCounts();
    return counts !== null && id !== tree().root.id && !counts.has(id);
  };

  return {
    tree,
    layout,
    openIds,
    searchOpen,
    matchCounts,
    foundCount: () => props.matches()?.size ?? null,
    selectedPath,
    selectedNode,
    isDimmed,
    isOpen: (id: string) => openIds().has(id),
    setBranch: (id: string, value: boolean) => {
      setOpen((prev) => {
        const next = new Set(prev);
        if (value) next.add(id);
        else next.delete(id);
        return next;
      });
    },
    expandAll: () => setOpen(new Set(branchIds(tree()).map((node) => node.id))),
    collapseAll: () => setOpen(new Set<string>()),
  };
};

export type MapState = ReturnType<typeof createMapState>;
