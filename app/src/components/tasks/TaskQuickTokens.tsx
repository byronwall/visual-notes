import { For } from "solid-js";
import { css } from "styled-system/css";

type Props = {
  tags: string[];
  onInsert: (token: string) => void;
};

const rowClass = css({
  display: "none",
  flexWrap: "wrap",
  gap: "1",
  w: "full",
  p: "1",
  pt: "0",
});

const tokenClass = css({
  flexShrink: 0,
  h: "10",
  px: "2.5",
  borderRadius: "l2",
  bg: "gray.a3",
  fontSize: "sm",
  color: "fg.muted",
  whiteSpace: "nowrap",
  cursor: "pointer",
  _active: { bg: "gray.a5" },
});

const BASE_TOKENS = [
  { label: "Today", token: "@today" },
  { label: "Tomorrow", token: "@tomorrow" },
  { label: "30m", token: "~30m" },
];

/** One-tap tokens: `@`, `#`, and `~` sit behind a key switch on an iPhone. */
export const TaskQuickTokens = (props: Props) => (
  <div class={rowClass} data-tokens data-testid="task-quick-add-tokens">
    <For
      each={[
        ...BASE_TOKENS,
        ...props.tags.map((tag) => ({ label: `#${tag}`, token: `#${tag}` })),
      ]}
    >
      {(item) => (
        <button
          type="button"
          class={tokenClass}
          // Keep focus in the field so the keyboard stays up.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => props.onInsert(item.token)}
        >
          {item.label}
        </button>
      )}
    </For>
  </div>
);
