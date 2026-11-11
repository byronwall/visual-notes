import { KanbanIcon, PlusIcon } from "lucide-solid";
import { For, Index, Show, createMemo, createSignal } from "solid-js";
import { css, cx } from "styled-system/css";
import {
  canGroupBy,
  groupRows,
  rankForDrop,
  type BoardGroup,
} from "~/lib/collections/group";
import { hasActiveSort, orderedProperties } from "~/lib/collections/query";
import type { CollectionRow, CollectionView } from "~/lib/collections/types";
import { useCollection } from "../CollectionContext";
import { draggable, startPointerDrag } from "../drag/startPointerDrag";
import { OptionChip } from "../values/OptionChip";
import { CardFields } from "./CardFields";
import { CardMenu, NONE } from "./CardMenu";
import { noAutofill } from "~/components/ui/no-autofill";

/** Below this container width a column fills most of it and snaps. */
const NARROW = "@container (max-width: 639px)";
const boardWrap = css({ containerType: "inline-size" });
const board = css({
  display: "flex",
  gap: "3",
  overflowX: "auto",
  pb: "3",
  alignItems: "flex-start",
  minH: "40",
  [NARROW]: { scrollSnapType: "x mandatory", gap: "2" },
});
const column = css({
  flex: "0 0 17rem",
  // On a phone the next column peeks in at the right edge.
  [NARROW]: { flexBasis: "85cqi", scrollSnapAlign: "start" },
  display: "flex",
  flexDirection: "column",
  gap: "1.5",
  p: "1.5",
  borderRadius: "l3",
  bg: "bg.subtle",
  "&[data-over]": { boxShadow: "inset 0 0 0 2px token(colors.border.accent)" },
});
const columnHead = css({
  display: "flex",
  alignItems: "center",
  gap: "2",
  px: "1",
  h: "7",
  fontSize: "sm",
});
const countCls = css({ color: "fg.subtle", fontSize: "xs" });
// The "…" menu is a sibling of the card: a button inside role="button"
// would be hidden from assistive tech.
const cardShell = css({ position: "relative" });
const card = css({
  display: "flex",
  flexDirection: "column",
  gap: "1.5",
  p: "2.5",
  borderRadius: "l2",
  bg: "bg.default",
  borderWidth: "1px",
  borderColor: "border",
  boxShadow: "xs",
  cursor: "pointer",
  textAlign: "left",
  _hover: { borderColor: "border.emphasized" },
});
const cardTitle = css({
  // Room for the "…" menu button in the corner.
  pr: "6",
  fontSize: "sm",
  fontWeight: "medium",
  lineHeight: "1.35",
  wordBreak: "break-word",
});
const marker = css({
  h: "2px",
  borderRadius: "full",
  bg: "border.accent",
  mx: "1",
});
const addBtn = css({
  display: "flex",
  alignItems: "center",
  gap: "1.5",
  h: "8",
  px: "1.5",
  borderRadius: "l2",
  fontSize: "sm",
  color: "fg.subtle",
  cursor: "pointer",
  _hover: { bg: "bg.muted", color: "fg.default" },
});
const newInput = css({
  p: "2.5",
  borderRadius: "l2",
  borderWidth: "1px",
  borderColor: "border.accent",
  bg: "bg.default",
  fontSize: "sm",
  outline: "none",
});
const emptyState = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "2",
  p: "6",
  borderWidth: "1px",
  borderStyle: "dashed",
  borderColor: "border",
  borderRadius: "l3",
  color: "fg.muted",
  fontSize: "sm",
});
const primaryBtn = css({
  h: "8",
  px: "3",
  borderRadius: "l2",
  bg: "fg.default",
  color: "bg.default",
  fontSize: "sm",
  cursor: "pointer",
});

/** Cards rendered per column before "Show more" (large collections stay fast). */
const COLUMN_PAGE = 50;

/** Kanban view: one column per select or status option; drag cards to change the value. */
export const CollectionBoard = (props: {
  view: CollectionView;
  /** Receives the action behind the toolbar's New button. */
  addRef?: (add: () => void) => void;
}) => {
  const { store, openRow } = useCollection();
  const [drop, setDrop] = createSignal<{ key: string; index: number } | null>(
    null,
  );
  const [draggingId, setDraggingId] = createSignal<string | null>(null);
  const [addingTo, setAddingTo] = createSignal<string | null>(null);
  const [menuFor, setMenuFor] = createSignal<string | null>(null);
  const [limits, setLimits] = createSignal<Record<string, number>>({});
  const limitFor = (key: string) => limits()[key] ?? COLUMN_PAGE;

  const groupProperty = createMemo(() => {
    const id = props.view.config.groupBy;
    const props_ = store.state.properties.filter(canGroupBy);
    return (
      props_.find((p) => p.id === id) ??
      props_.find((p) => p.kind === "status") ??
      props_[0]
    );
  });
  const cardProperties = createMemo(() => {
    const chosen = props.view.config.cardProperties;
    const all = orderedProperties(store.state.properties, props.view.config, {
      includeHidden: true,
    });
    if (chosen) return all.filter((p) => chosen.includes(p.id));
    return all.filter((p) => p.id !== groupProperty()?.id).slice(0, 3);
  });
  const rows = createMemo(() => store.viewRows(props.view));
  const groups = createMemo<BoardGroup[]>(() => {
    const property = groupProperty();
    if (!property) return [];
    const all = groupRows(rows(), property, props.view.config.hiddenGroups);
    // New rows land here, so it leads instead of sitting past the right edge.
    const none = all.find((g) => g.key === null);
    return none?.rows.length ? [none, ...all.filter((g) => g !== none)] : all;
  });

  props.addRef?.(() => {
    const first = groups()[0];
    if (first) {
      setAddingTo(first.key ?? NONE);
      return;
    }
    void store.addRow().then((row) => row && openRow(row.id));
  });

  const locate = (x: number, y: number) => {
    const col = document
      .elementsFromPoint(x, y)
      .map((el) =>
        (el as HTMLElement).closest<HTMLElement>(
          `[data-board="${props.view.id}"] [data-board-column]`,
        ),
      )
      .find(Boolean);
    if (!col) return null;
    const key = col.dataset.boardColumn!;
    const cards = [
      ...col.querySelectorAll<HTMLElement>("[data-card-id]"),
    ].filter((c) => c.dataset.cardId !== draggingId());
    const index = cards.findIndex((c) => {
      const r = c.getBoundingClientRect();
      return y < r.top + r.height / 2;
    });
    return { key, index: index < 0 ? cards.length : index };
  };

  const finishDrop = (row: CollectionRow, x: number, y: number) => {
    const target = locate(x, y);
    setDrop(null);
    setDraggingId(null);
    const property = groupProperty();
    if (!target || !property) return;
    const value = target.key === NONE ? null : target.key;
    const current = row.properties[property.id] ?? null;
    const patch = current === value ? undefined : { [property.id]: value };
    if (hasActiveSort(props.view.config)) {
      if (patch) void store.setValues([row.id], patch);
      return;
    }
    const columnRows = (
      groups().find((g) => (g.key ?? NONE) === target.key)?.rows ?? []
    ).filter((r) => r.id !== row.id);
    const { after, before } = rankForDrop(columnRows, target.index);
    void store.moveRow(row.id, after, before, patch);
  };

  const columnOf = (key: string) =>
    groups().find((g) => (g.key ?? NONE) === key)?.rows ?? [];

  /** Menu "Move to": the card lands at the top of the target column. */
  const moveTo = (row: CollectionRow, key: string) => {
    const property = groupProperty();
    if (!property) return;
    const value = key === NONE ? null : key;
    if ((row.properties[property.id] ?? null) === value) return;
    const patch = { [property.id]: value };
    if (hasActiveSort(props.view.config)) {
      void store.setValues([row.id], patch);
      return;
    }
    const { after, before } = rankForDrop(columnOf(key), 0);
    void store.moveRow(row.id, after, before, patch);
  };

  /** Menu "Move up/down" within the card's column. */
  const shift = (row: CollectionRow, key: string, delta: -1 | 1) => {
    const col = columnOf(key);
    const index = col.findIndex((r) => r.id === row.id) + delta;
    const rest = col.filter((r) => r.id !== row.id);
    if (index < 0 || index > rest.length) return;
    const { after, before } = rankForDrop(rest, index);
    void store.moveRow(row.id, after, before);
  };

  const createIn = async (group: BoardGroup, title: string) => {
    const property = groupProperty();
    const last = group.rows[group.rows.length - 1];
    await store.addRow({
      title,
      properties: property && group.key ? { [property.id]: group.key } : {},
      ...(last && !hasActiveSort(props.view.config)
        ? { afterRank: last.rank, beforeRank: null }
        : {}),
    });
  };

  return (
    <Show
      when={groupProperty()}
      fallback={
        <div class={emptyState}>
          <KanbanIcon size={18} />A board groups rows by a Select or Status
          property. This collection has none yet.
          <button
            type="button"
            class={primaryBtn}
            onClick={async () => {
              const created = await store.addProperty("status", "Status");
              if (created)
                store.patchViewConfig(props.view.id, { groupBy: created.id });
            }}
          >
            Add a Status property
          </button>
        </div>
      }
    >
      <div class={boardWrap}>
        <div class={board} data-board={props.view.id}>
          <Index each={groups()}>
            {(groupAt) => {
              const group = () => groupAt();
              const key = () => groupAt().key ?? NONE;
              return (
                <div
                  class={column}
                  data-board-column={key()}
                  data-over={drop()?.key === key() ? "" : undefined}
                >
                  <div class={columnHead}>
                    <Show
                      when={group().option}
                      fallback={
                        <span class={countCls}>
                          No {groupProperty()!.name.toLowerCase()}
                        </span>
                      }
                    >
                      {(option) => (
                        <OptionChip
                          option={option()}
                          showDot={groupProperty()!.kind === "status"}
                        />
                      )}
                    </Show>
                    <span class={countCls}>{group().rows.length}</span>
                  </div>
                  <For each={group().rows.slice(0, limitFor(key()))}>
                    {(row, i) => (
                      <>
                        <Show
                          when={
                            drop()?.key === key() &&
                            drop()?.index === i() &&
                            draggingId() !== row.id
                          }
                        >
                          <div class={marker} />
                        </Show>
                        <div
                          class={cardShell}
                          data-card-id={row.id}
                          data-dragging={
                            draggingId() === row.id ? "" : undefined
                          }
                        >
                          <div
                            class={cx(card, draggable)}
                            role="button"
                            tabIndex={0}
                            onPointerDown={(e) =>
                              startPointerDrag(e, e.currentTarget, {
                                onStart: () => {
                                  setDraggingId(row.id);
                                },
                                onMove: (x, y) => setDrop(locate(x, y)),
                                onDrop: (x, y) => finishDrop(row, x, y),
                                onCancel: () => {
                                  setDrop(null);
                                  setDraggingId(null);
                                },
                                onLongPress: () => setMenuFor(row.id),
                              })
                            }
                            onClick={() => openRow(row.id)}
                            onKeyDown={(e) =>
                              (e.key === "Enter" || e.key === " ") &&
                              (e.preventDefault(), openRow(row.id))
                            }
                          >
                            <span class={cardTitle}>
                              {row.title || "Untitled"}
                            </span>
                            <CardFields
                              row={row}
                              properties={cardProperties()}
                              showEmpty={Boolean(
                                props.view.config.cardProperties,
                              )}
                            />
                          </div>
                          <CardMenu
                            open={menuFor() === row.id}
                            onOpenChange={(open) =>
                              setMenuFor(open ? row.id : null)
                            }
                            groups={groups()}
                            property={groupProperty()!}
                            currentKey={key()}
                            canReorder={!hasActiveSort(props.view.config)}
                            isFirst={i() === 0}
                            isLast={i() === group().rows.length - 1}
                            onOpenRow={() => openRow(row.id)}
                            onMoveTo={(k) => moveTo(row, k)}
                            onShift={(d) => shift(row, key(), d)}
                          />
                        </div>
                      </>
                    )}
                  </For>
                  <Show
                    when={
                      drop()?.key === key() &&
                      drop()!.index >=
                        group()
                          .rows.slice(0, limitFor(key()))
                          .filter((r) => r.id !== draggingId()).length
                    }
                  >
                    <div class={marker} />
                  </Show>
                  <Show when={group().rows.length > limitFor(key())}>
                    <button
                      type="button"
                      class={addBtn}
                      onClick={() =>
                        setLimits((l) => ({
                          ...l,
                          [key()]: limitFor(key()) + COLUMN_PAGE,
                        }))
                      }
                    >
                      Show{" "}
                      {Math.min(
                        COLUMN_PAGE,
                        group().rows.length - limitFor(key()),
                      )}{" "}
                      more
                    </button>
                  </Show>
                  <Show
                    when={addingTo() === key()}
                    fallback={
                      <button
                        type="button"
                        class={addBtn}
                        onClick={() => setAddingTo(key())}
                      >
                        <PlusIcon size={14} /> New
                      </button>
                    }
                  >
                    <input
                      {...noAutofill}
                      class={newInput}
                      placeholder="Name, then Enter"
                      aria-label="New card name"
                      ref={(el) => queueMicrotask(() => el.focus())}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const title = e.currentTarget.value.trim();
                          e.currentTarget.value = "";
                          if (title) void createIn(group(), title);
                        } else if (e.key === "Escape") setAddingTo(null);
                      }}
                      onBlur={(e) => {
                        const title = e.currentTarget.value.trim();
                        if (title) void createIn(group(), title);
                        setAddingTo(null);
                      }}
                    />
                  </Show>
                </div>
              );
            }}
          </Index>
        </div>
      </div>
    </Show>
  );
};
