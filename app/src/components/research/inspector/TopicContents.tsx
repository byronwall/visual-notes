import { ChevronRightIcon } from "lucide-solid";
import { createMemo, createSignal, For, Show } from "solid-js";
import { css } from "styled-system/css";
import { HighlightMatch } from "~/components/archive/list/HighlightMatch";
import type { ResearchCard } from "~/services/research/research.types";
import { CardGlyph } from "../cardTypeMeta";
import type { TopicData } from "../createTopicData";
import { bodyExcerpt, cardMatches, contentsSections } from "./contents";

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
  _focusVisible: {
    outline: "2px solid token(colors.border.focus)",
    outlineOffset: "-2px",
  },
});

/** ↑/↓ (and Home/End) walk the visible rows, like a list box. */
const moveFocus = (event: KeyboardEvent) => {
  const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
  if (!keys.includes(event.key)) return;
  const nav = event.currentTarget as HTMLElement;
  const rows = [
    ...nav.querySelectorAll<HTMLElement>("[data-testid=research-contents-row]"),
  ];
  if (!rows.length) return;
  event.preventDefault();
  const at = rows.indexOf(document.activeElement as HTMLElement);
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? rows.length - 1
        : Math.max(
            0,
            Math.min(
              rows.length - 1,
              at + (event.key === "ArrowDown" ? 1 : -1),
            ),
          );
  rows[next].focus();
};

const RowIcon = (props: { card: ResearchCard }) => (
  <span class={css({ display: "inline-flex", pt: "0.5", flexShrink: 0 })}>
    <CardGlyph card={props.card} size={13} />
  </span>
);

/**
 * Every card in one dense list, grouped by stream in the board's order, so a
 * card sits in the same place here and there. Searching filters this list and
 * dims the board.
 */
export const TopicContents = (props: {
  data: TopicData;
  query: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) => {
  const [collapsed, setCollapsed] = createSignal(new Set<string>());
  const sections = createMemo(() => {
    const query = props.query;
    return contentsSections(props.data.board(), props.data.cards(), (card) =>
      cardMatches(card, query),
    );
  });
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
    <nav
      aria-label="Topic contents"
      data-testid="research-contents"
      onKeyDown={moveFocus}
    >
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
              {section.label}
              <span
                class={css({
                  color: "fg.subtle",
                  fontVariantNumeric: "tabular-nums",
                })}
              >
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
                        data-faded={
                          card.state === "done" || card.state === "dropped"
                        }
                        data-testid="research-contents-row"
                        onClick={() => props.onSelect(card.id)}
                      >
                        <RowIcon card={card} />
                        <span class={css({ minW: 0, flex: 1 })}>
                          <span
                            class={css({
                              textDecoration:
                                card.state === "dropped"
                                  ? "line-through"
                                  : undefined,
                            })}
                          >
                            <HighlightMatch
                              text={card.title}
                              query={props.query}
                            />
                          </span>
                          <Show
                            when={searching() && bodyExcerpt(card, props.query)}
                          >
                            {(excerpt) => (
                              <span
                                class={css({
                                  display: "block",
                                  fontSize: "xs",
                                  color: "fg.muted",
                                  mt: "0.5",
                                })}
                              >
                                <HighlightMatch
                                  text={excerpt()}
                                  query={props.query}
                                />
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
          {searching()
            ? `No cards match “${props.query.trim()}”.`
            : "No cards yet."}
        </p>
      </Show>
    </nav>
  );
};
