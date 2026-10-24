import { ChevronRightIcon } from "lucide-solid";
import { createMemo, createSignal, For, Show } from "solid-js";
import { css } from "styled-system/css";
import { HighlightMatch } from "~/components/archive/list/HighlightMatch";
import type { ResearchCard } from "~/services/research/research.types";
import { CARD_STATE_META, CardTypeIcon } from "../cardTypeMeta";
import type { TopicData } from "../createTopicData";
import { TYPE_PLURAL } from "../layout/sections";
import { bodyExcerpt, cardMatches, contentsSections, treeOrder, type ContentsSection } from "./contents";

const headingClass = css({
  position: "sticky",
  top: 0,
  zIndex: 1,
  display: "flex",
  alignItems: "center",
  gap: "1",
  w: "full",
  h: "7",
  px: "1",
  bg: "bg.default",
  fontSize: "xs",
  fontWeight: "medium",
  letterSpacing: "wider",
  textTransform: "uppercase",
  color: "fg.muted",
  cursor: "pointer",
  transitionProperty: "color",
  transitionDuration: "140ms",
  _hover: { color: "fg.default" },
  "& svg": { transitionProperty: "transform", transitionDuration: "140ms" },
  "&[aria-expanded=true] svg": { transform: "rotate(90deg)" },
});

const rowClass = css({
  display: "flex",
  alignItems: "flex-start",
  gap: "1.5",
  w: "full",
  px: "1",
  py: "1",
  textAlign: "left",
  fontSize: "sm",
  lineHeight: "1.35",
  borderRadius: "l1",
  cursor: "pointer",
  transitionProperty: "background-color",
  transitionDuration: "140ms",
  _hover: { bg: "bg.hover" },
  "&[data-selected=true]": { bg: "bg.selected", color: "fg.selected" },
  "&[data-faded=true]": { color: "fg.muted" },
});

const SECTION_LABEL: Record<"open" | "closed", string> = { open: "Open", closed: "Done and dropped" };

const sectionLabel = (key: ContentsSection["key"]) =>
  key === "open" || key === "closed" ? SECTION_LABEL[key] : TYPE_PLURAL[key];

const RowIcon = (props: { card: ResearchCard }) => (
  <span class={css({ display: "inline-flex", pt: "0.5", flexShrink: 0 })}>
    <Show when={props.card.state} fallback={<CardTypeIcon type={props.card.type} size={13} />}>
      {(state) => (
        <span
          class={css({
            display: "inline-flex",
            color: state() === "open" ? "amber.11" : state() === "done" ? "green.11" : "fg.muted",
          })}
          title={`${CARD_STATE_META[state()].label} ${props.card.type}`}
        >
          {CARD_STATE_META[state()].icon({ size: 13, strokeWidth: 2 })}
        </span>
      )}
    </Show>
  </span>
);

/**
 * Every card in one dense list: the open frontier first, then each type, with
 * finished work folded away. Searching filters this list and dims the canvas.
 */
export const TopicContents = (props: {
  data: TopicData;
  query: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) => {
  // Done and dropped start folded; everything else starts open.
  const [collapsed, setCollapsed] = createSignal(new Set<string>(["closed"]));
  const drafts = createMemo(
    () => new Set((props.data.current()?.groups ?? []).filter((g) => g.status === "draft").map((g) => g.summaryCardId)),
  );
  const order = createMemo(() => treeOrder(props.data.children(), props.data.cards()));
  const sections = createMemo(() =>
    contentsSections(
      props.data.cards().filter((card) => cardMatches(card, props.query)),
      order(),
    ),
  );
  const searching = () => props.query.trim().length > 0;
  const isOpen = (key: string) => searching() || !collapsed().has(key);
  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <nav aria-label="Topic contents" data-testid="research-contents">
      <For each={sections()}>
        {(section) => (
          <section class={css({ mb: "1.5" })}>
            <button
              type="button"
              class={headingClass}
              aria-expanded={isOpen(section.key)}
              onClick={() => toggle(section.key)}
            >
              <ChevronRightIcon size={12} />
              {sectionLabel(section.key)}
              <span class={css({ color: "fg.subtle", fontVariantNumeric: "tabular-nums" })}>
                {section.cards.length}
              </span>
            </button>
            <Show when={isOpen(section.key)}>
              <ul>
                <For each={section.cards}>
                  {(card) => (
                    <li>
                      <button
                        type="button"
                        class={rowClass}
                        data-selected={props.selectedId === card.id}
                        data-faded={card.state === "done" || card.state === "dropped"}
                        data-testid="research-contents-row"
                        onClick={() => props.onSelect(card.id)}
                      >
                        <RowIcon card={card} />
                        <span class={css({ minW: 0, flex: 1 })}>
                          <span class={css({ textDecoration: card.state === "dropped" ? "line-through" : undefined })}>
                            <HighlightMatch text={card.title} query={props.query} />
                          </span>
                          <Show when={drafts().has(card.id)}>
                            <span class={css({ ml: "1.5", fontSize: "xs", color: "amber.11" })}>Draft</span>
                          </Show>
                          <Show when={searching() && bodyExcerpt(card, props.query)}>
                            {(excerpt) => (
                              <span class={css({ display: "block", fontSize: "xs", color: "fg.muted", mt: "0.5" })}>
                                <HighlightMatch text={excerpt()} query={props.query} />
                              </span>
                            )}
                          </Show>
                        </span>
                      </button>
                    </li>
                  )}
                </For>
              </ul>
            </Show>
          </section>
        )}
      </For>
      <Show when={!sections().length}>
        <p class={css({ fontSize: "sm", color: "fg.muted", px: "1", py: "2" })}>
          No cards match “{props.query.trim()}”.
        </p>
      </Show>
    </nav>
  );
};
