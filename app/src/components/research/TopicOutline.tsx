import { useAction } from "@solidjs/router";
import { ChevronRightIcon } from "lucide-solid";
import { createEffect, createSignal, For, on, onMount, Show } from "solid-js";
import { css } from "styled-system/css";
import { setResearchCardState } from "~/services/research/research.actions";
import type { ResearchCard, ResearchCardState } from "~/services/research/research.types";
import { HighlightMatch } from "~/components/archive/list/HighlightMatch";
import { CardBody } from "./CardBody";
import { CARD_STATE_META, CardTypeIcon } from "./cardTypeMeta";
import type { TopicData } from "./createTopicData";
import { SECTION_MIN, sectionByType, TYPE_PLURAL } from "./layout/sections";

const NEXT_STATE: Record<ResearchCardState, ResearchCardState> = { open: "done", done: "dropped", dropped: "open" };

const rowClass = css({
  display: "flex",
  alignItems: "flex-start",
  gap: "1",
  py: "1",
  pr: "2",
  borderRadius: "l2",
  transitionProperty: "background-color, opacity",
  transitionDuration: "fast",
  _hover: { bg: "bg.hover" },
  "&[data-faded=true]": { opacity: 0.55 },
  "&[data-dimmed=true]": { opacity: 0.3 },
  "&[data-selected=true]": { bg: "bg.selected" },
});

const stateButtonClass = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  w: "5",
  h: "5",
  flexShrink: 0,
  borderRadius: "l1",
  color: "fg.muted",
  cursor: "pointer",
  transitionProperty: "background-color, color",
  transitionDuration: "fast",
  _hover: { bg: "gray.a4", color: "fg.default" },
  "&[data-state=open]": { color: "amber.11" },
  "&[data-state=done]": { color: "green.11" },
  "@media (pointer: coarse)": { w: "8", h: "8" },
});

const isFaded = (card: ResearchCard) => card.state === "done" || card.state === "dropped";

const toggleClass = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  w: "4",
  h: "5",
  flexShrink: 0,
  color: "fg.subtle",
  cursor: "pointer",
  borderRadius: "l1",
  transitionProperty: "color",
  transitionDuration: "140ms",
  _hover: { color: "fg.default" },
  "& svg": { transitionProperty: "transform", transitionDuration: "140ms" },
  "&[aria-expanded=true] svg": { transform: "rotate(90deg)" },
});

const sectionHeadingClass = css({
  display: "flex",
  alignItems: "center",
  gap: "1.5",
  pt: "2",
  pb: "0.5",
  fontSize: "xs",
  fontWeight: "medium",
  letterSpacing: "wider",
  textTransform: "uppercase",
  color: "fg.muted",
});

const INDENT = 20;

type OutlineState = {
  data: TopicData;
  selectedId: string | null;
  matches: Set<string> | null;
  query: string;
  details: boolean;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
};

type NodeProps = { card: ResearchCard; depth: number; faded: boolean; state: OutlineState };

/** A branch's children; busy branches list them under type headings, like the canvas lanes. */
const OutlineChildren = (props: { kids: ResearchCard[]; depth: number; faded: boolean; state: OutlineState }) => {
  const sections = () =>
    props.kids.length > SECTION_MIN
      ? sectionByType(props.kids, (card) => card.type)
      : [{ type: null, items: props.kids }];
  return (
    <ul>
      <For each={sections()}>
        {(section) => (
          <>
            <Show when={section.type}>
              {(type) => (
                <li class={sectionHeadingClass} style={{ "padding-left": `${props.depth * INDENT + 26}px` }}>
                  {TYPE_PLURAL[type()]}
                  <span class={css({ color: "fg.subtle", fontVariantNumeric: "tabular-nums" })}>
                    {section.items.length}
                  </span>
                </li>
              )}
            </Show>
            <For each={section.items}>
              {(child) => <OutlineNode card={child} depth={props.depth} faded={props.faded} state={props.state} />}
            </For>
          </>
        )}
      </For>
    </ul>
  );
};

const OutlineNode = (props: NodeProps) => {
  const runSetState = useAction(setResearchCardState);
  const kids = () => props.state.data.children().get(props.card.id) ?? [];
  const faded = () => props.faded || isFaded(props.card);
  const selected = () => props.state.selectedId === props.card.id;
  const expanded = () => !!props.state.query.trim() || !props.state.collapsed.has(props.card.id);
  const dimmed = () => !!props.state.matches && !props.state.matches.has(props.card.id);
  let row: HTMLDivElement | undefined;

  // Picked from Contents or the canvas: scroll the row into view.
  createEffect(() => {
    if (selected()) row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  });

  const cycleState = async () => {
    if (!props.card.state) return;
    await runSetState({ id: props.card.id, state: NEXT_STATE[props.card.state] });
    props.state.data.reload();
  };

  return (
    <li>
      <div
        ref={row}
        class={rowClass}
        style={{ "padding-left": `${props.depth * INDENT + 4}px` }}
        data-faded={faded()}
        data-dimmed={dimmed()}
        data-selected={selected()}
        data-testid="research-outline-row"
        data-card-type={props.card.type}
      >
        <Show when={kids().length} fallback={<span class={css({ w: "4", flexShrink: 0 })} />}>
          <button
            type="button"
            class={toggleClass}
            aria-expanded={expanded()}
            aria-label={expanded() ? "Collapse" : `Expand ${kids().length} below`}
            onClick={() => props.state.onToggle(props.card.id)}
          >
            <ChevronRightIcon size={14} />
          </button>
        </Show>
        <span class={css({ display: "inline-flex", w: "5", h: "5", alignItems: "center", justifyContent: "center" })}>
          <Show when={props.card.state} fallback={<CardTypeIcon type={props.card.type} />}>
            {(state) => (
              <button
                type="button"
                class={stateButtonClass}
                data-state={state()}
                title={`${CARD_STATE_META[state()].label} — click for ${CARD_STATE_META[NEXT_STATE[state()]].label.toLowerCase()}`}
                aria-label={`${props.card.type} ${CARD_STATE_META[state()].label}`}
                onClick={cycleState}
              >
                {CARD_STATE_META[state()].icon({ size: 14, strokeWidth: 2 })}
              </button>
            )}
          </Show>
        </span>
        <div class={css({ minW: 0, flex: 1, display: "flex", flexDirection: "column", gap: "0.5" })}>
          <div class={css({ display: "flex", alignItems: "baseline", gap: "1.5" })}>
            <Show when={props.card.state}>
              <span class={css({ alignSelf: "center", display: "inline-flex" })}>
                <CardTypeIcon type={props.card.type} size={12} />
              </span>
            </Show>
            <button
              type="button"
              class={css({
                fontSize: "sm",
                textAlign: "left",
                cursor: "pointer",
                textDecoration: props.card.state === "dropped" ? "line-through" : undefined,
                _hover: { color: "fg.link" },
              })}
              onClick={() => props.state.onSelect(props.card.id)}
            >
              <HighlightMatch text={props.card.title} query={props.state.query} />
            </button>
            <Show when={!expanded()}>
              <span
                class={css({ fontSize: "xs", color: "fg.subtle", fontVariantNumeric: "tabular-nums", flexShrink: 0 })}
              >
                {kids().length} below
              </span>
            </Show>
          </div>
          <Show when={props.state.details}>
            <CardBody card={props.card} compact />
          </Show>
        </div>
      </div>
      <Show when={kids().length && expanded()}>
        <OutlineChildren kids={kids()} depth={props.depth + 1} faded={faded()} state={props.state} />
      </Show>
    </li>
  );
};

const barButtonClass = css({
  px: "2",
  h: "7",
  fontSize: "sm",
  color: "fg.muted",
  borderRadius: "l1",
  cursor: "pointer",
  transitionProperty: "background-color, color",
  transitionDuration: "140ms",
  _hover: { bg: "bg.hover", color: "fg.default" },
  "&[aria-pressed=true]": { bg: "bg.selected", color: "fg.selected", fontWeight: "medium" },
});

const DETAILS_KEY = "research-outline-details";

export const TopicOutline = (props: {
  data: TopicData;
  selectedId: string | null;
  matches: Set<string> | null;
  query: string;
  onSelect: (id: string) => void;
}) => {
  const roots = () => props.data.children().get(null) ?? [];
  const [collapsed, setCollapsed] = createSignal(new Set<string>());
  // Matches the server render first; the saved preference applies after mount.
  const [details, setDetails] = createSignal(true);
  onMount(() => {
    try {
      if (localStorage.getItem(DETAILS_KEY) === "0") setDetails(false);
    } catch {
      // Storage can be blocked; keep the default.
    }
  });
  const setDetailsSaved = (value: boolean) => {
    setDetails(value);
    try {
      localStorage.setItem(DETAILS_KEY, value ? "1" : "0");
    } catch {
      // Not saved; the toggle still works for this visit.
    }
  };
  const branchIds = () => [...props.data.children().keys()].filter((id): id is string => id !== null);
  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  // Expanding everything keeps the selected card reachable after a collapse.
  createEffect(
    on(
      () => props.selectedId,
      (id) => {
        if (!id) return;
        const byId = props.data.cardsById();
        let parent = byId.get(id)?.parentId;
        const open = new Set(collapsed());
        let changed = false;
        while (parent) {
          if (open.delete(parent)) changed = true;
          parent = byId.get(parent)?.parentId;
        }
        if (changed) setCollapsed(open);
      },
    ),
  );

  const state: OutlineState = {
    get data() {
      return props.data;
    },
    get selectedId() {
      return props.selectedId;
    },
    get matches() {
      return props.matches;
    },
    get query() {
      return props.query;
    },
    get details() {
      return details();
    },
    get collapsed() {
      return collapsed();
    },
    onToggle: toggle,
    onSelect: (id) => props.onSelect(id),
  };

  return (
    <div class={css({ maxW: "56rem" })}>
      <div
        role="toolbar"
        aria-label="Outline"
        class={css({ position: "sticky", top: 0, zIndex: 1, display: "flex", gap: "0.5", py: "1", bg: "bg.default" })}
      >
        <button
          type="button"
          class={barButtonClass}
          aria-pressed={details()}
          onClick={() => setDetailsSaved(!details())}
        >
          Details
        </button>
        <span class={css({ w: "1px", h: "4", bg: "border", mx: "1", alignSelf: "center" })} />
        <button type="button" class={barButtonClass} onClick={() => setCollapsed(new Set(branchIds()))}>
          Collapse all
        </button>
        <button type="button" class={barButtonClass} onClick={() => setCollapsed(new Set())}>
          Expand all
        </button>
      </div>
      <ul class={css({ display: "flex", flexDirection: "column" })} aria-label="Topic outline">
        <For each={roots()}>{(card) => <OutlineNode card={card} depth={0} faded={false} state={state} />}</For>
      </ul>
    </div>
  );
};
