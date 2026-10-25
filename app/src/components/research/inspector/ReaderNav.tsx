import { ChevronLeftIcon, ChevronRightIcon } from "lucide-solid";
import { Show } from "solid-js";
import { css } from "styled-system/css";
import type { ResearchCard } from "~/services/research/research.types";
import type { TopicData } from "../createTopicData";

const navButtonClass = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  w: "7",
  h: "7",
  borderRadius: "l1",
  color: "fg.muted",
  cursor: "pointer",
  transitionProperty: "background-color, color",
  transitionDuration: "140ms",
  _hover: { bg: "bg.hover", color: "fg.default" },
  _disabled: {
    color: "fg.subtle",
    cursor: "default",
    _hover: { bg: "transparent" },
  },
});

/** Previous / next card in the selected card's stream, in board order. */
export const ReaderNav = (props: {
  data: TopicData;
  card: ResearchCard;
  onSelect: (id: string) => void;
}) => {
  const board = () => props.data.board();
  const column = () => {
    const columnId = board().columnOf.get(props.card.id);
    return board().columns.find((entry) => entry.column.id === columnId);
  };
  const order = () => column()?.order ?? [];
  const index = () => order().indexOf(props.card.id);
  const step = (delta: number) => {
    const next = order()[index() + delta];
    if (next) props.onSelect(next);
  };

  return (
    <Show when={column() && index() >= 0}>
      <nav
        aria-label="Stream navigation"
        class={css({
          display: "flex",
          alignItems: "center",
          gap: "1",
          mb: "2",
          fontSize: "xs",
          color: "fg.muted",
        })}
      >
        <button
          type="button"
          class={navButtonClass}
          aria-label="Previous card"
          disabled={index() <= 0}
          onClick={() => step(-1)}
        >
          <ChevronLeftIcon size={14} />
        </button>
        <span
          class={css({
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
          })}
        >
          {index() + 1} of {order().length}
        </span>
        <button
          type="button"
          class={navButtonClass}
          aria-label="Next card"
          disabled={index() >= order().length - 1}
          onClick={() => step(1)}
        >
          <ChevronRightIcon size={14} />
        </button>
        <span
          class={css({
            minW: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          })}
        >
          in {column()!.column.title}
        </span>
      </nav>
    </Show>
  );
};
