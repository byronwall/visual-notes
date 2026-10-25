import { Maximize2Icon, Minimize2Icon, SearchIcon, XIcon } from "lucide-solid";
import { For, Match, onCleanup, onMount, Show, Switch } from "solid-js";
import { css } from "styled-system/css";
import { Kbd } from "~/components/ui/kbd";
import type { ResearchCard } from "~/services/research/research.types";
import type { TopicData } from "../createTopicData";
import { CardDetailPanel } from "../detail/CardDetailPanel";
import { TopicBatchList } from "../TopicBatchList";
import { TopicContents } from "./TopicContents";

export type InspectorTab = "contents" | "card" | "history";

const tabClass = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "1",
  px: "2",
  h: "7",
  fontSize: "sm",
  color: "fg.muted",
  borderRadius: "l1",
  cursor: "pointer",
  transitionProperty: "background-color, color",
  transitionDuration: "140ms",
  _hover: { bg: "bg.hover", color: "fg.default" },
  _disabled: {
    color: "fg.subtle",
    cursor: "default",
    _hover: { bg: "transparent" },
  },
  "&[data-active=true]": {
    bg: "bg.selected",
    color: "fg.selected",
    fontWeight: "medium",
  },
});

const searchClass = css({
  display: "flex",
  alignItems: "center",
  gap: "1.5",
  h: "8",
  px: "2",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "l2",
  color: "fg.muted",
  bg: "bg.default",
  transitionProperty: "border-color",
  transitionDuration: "140ms",
  _focusWithin: { borderColor: "border.focus" },
  "& input": {
    flex: 1,
    minW: 0,
    fontSize: "sm",
    color: "fg.default",
    outline: "none",
    bg: "transparent",
  },
});

// Expanded, text keeps a readable measure in the middle of the wide panel.
const readingClass = css({
  "&[data-expanded=true]": {
    maxW: "56rem",
    mx: "auto",
    pt: "2",
    "& .research-card-body": { maxW: "none" },
  },
});

/** The right rail: every card (Contents), the selected card, and agent history. */
export const TopicInspector = (props: {
  data: TopicData;
  tab: InspectorTab;
  onTab: (tab: InspectorTab) => void;
  selected: ResearchCard | null;
  onSelect: (id: string | null) => void;
  query: string;
  onQuery: (query: string) => void;
  nowMs: number;
  /** Full-width reading mode over the board. */
  expanded: boolean;
  onToggleExpand: () => void;
}) => {
  let input: HTMLInputElement | undefined;
  const tabs = () => [
    { id: "contents" as const, label: "Contents", disabled: false },
    { id: "card" as const, label: "Card", disabled: !props.selected },
    { id: "history" as const, label: "History", disabled: false },
  ];

  // "/" jumps to the topic search from anywhere on the page but a text field.
  onMount(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable=true]")) return;
      event.preventDefault();
      props.onTab("contents");
      queueMicrotask(() => input?.focus());
    };
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });

  return (
    <div
      class={css({
        display: "flex",
        flexDirection: "column",
        h: "full",
        minH: 0,
      })}
    >
      <div
        class={css({
          display: "flex",
          flexDirection: "column",
          gap: "2",
          px: "3",
          pt: "2",
          pb: "1.5",
        })}
      >
        <div class={css({ display: "flex", alignItems: "center", gap: "0.5" })}>
          <div
            role="tablist"
            aria-label="Inspector"
            class={css({ display: "flex", gap: "0.5", flex: 1 })}
          >
            <For each={tabs()}>
              {(entry) => (
                <button
                  type="button"
                  role="tab"
                  class={tabClass}
                  aria-selected={props.tab === entry.id}
                  data-active={props.tab === entry.id}
                  disabled={entry.disabled}
                  onClick={() => props.onTab(entry.id)}
                >
                  {entry.label}
                </button>
              )}
            </For>
          </div>
          <button
            type="button"
            class={tabClass}
            aria-pressed={props.expanded}
            aria-label={props.expanded ? "Back to side panel" : "Expand reader"}
            title={
              props.expanded ? "Back to side panel (Esc)" : "Expand reader"
            }
            data-testid="research-reader-expand"
            onClick={() => props.onToggleExpand()}
          >
            <Show when={props.expanded} fallback={<Maximize2Icon size={14} />}>
              <Minimize2Icon size={14} />
            </Show>
          </button>
        </div>
        <Show when={props.tab === "contents"}>
          <label class={searchClass}>
            <SearchIcon size={14} />
            <input
              ref={input}
              type="search"
              placeholder="Search cards"
              aria-label="Search cards"
              value={props.query}
              onInput={(event) => props.onQuery(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  props.onQuery("");
                  event.currentTarget.blur();
                }
                // ↓ from the field moves into the list.
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  document
                    .querySelector<HTMLElement>(
                      "[data-testid=research-contents-row]",
                    )
                    ?.focus();
                }
              }}
            />
            <Show when={!props.query}>
              <Kbd
                size="sm"
                aria-hidden="true"
                class={css({ color: "fg.subtle" })}
              >
                /
              </Kbd>
            </Show>
            <Show when={props.query}>
              <button
                type="button"
                aria-label="Clear search"
                class={css({
                  display: "inline-flex",
                  cursor: "pointer",
                  color: "fg.muted",
                  _hover: { color: "fg.default" },
                })}
                onClick={() => props.onQuery("")}
              >
                <XIcon size={14} />
              </button>
            </Show>
          </label>
        </Show>
      </div>
      <div
        class={css({ flex: 1, minH: 0, overflowY: "auto", px: "3", pb: "3" })}
      >
        <div class={readingClass} data-expanded={props.expanded}>
          {/* Contents stays mounted so its scroll and folded sections survive a trip to Card. */}
          <div
            style={{ display: props.tab === "contents" ? undefined : "none" }}
          >
            <TopicContents
              data={props.data}
              query={props.query}
              selectedId={props.selected?.id ?? null}
              onSelect={props.onSelect}
            />
          </div>
          <Switch>
            <Match when={props.tab === "card" && props.selected}>
              {(card) => (
                <CardDetailPanel
                  data={props.data}
                  card={card()}
                  onSelect={props.onSelect}
                />
              )}
            </Match>
            <Match when={props.tab === "history"}>
              <TopicBatchList data={props.data} nowMs={props.nowMs} />
            </Match>
          </Switch>
        </div>
      </div>
    </div>
  );
};
