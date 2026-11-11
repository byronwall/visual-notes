import { LayoutListIcon, Table2Icon } from "lucide-solid";
import { For } from "solid-js";
import { css } from "styled-system/css";
import type { ListMode, ListModeState } from "./useListMode";

// Shown only where the list can apply: a toolbar narrower than LIST_MAX_WIDTH.
// Pure CSS, so the server render and the first client render match.
const group = css({
  display: "none",
  "@container coltoolbar (max-width: 639.98px)": { display: "inline-flex" },
  alignItems: "center",
  h: "7",
  p: "0.5",
  gap: "0.5",
  borderRadius: "l2",
  bg: "bg.muted",
  flexShrink: "0",
});
const seg = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "1",
  h: "6",
  minW: "7",
  px: "1.5",
  borderRadius: "l1",
  color: "fg.muted",
  fontSize: "xs",
  fontWeight: "medium",
  cursor: "pointer",
  transition: "color 140ms, background-color 140ms",
  "&[aria-pressed=true]": {
    bg: "bg.default",
    color: "fg.default",
    boxShadow: "xs",
  },
  // A very narrow toolbar keeps the icons; the names stay in aria-label.
  "@container coltoolbar (max-width: 22rem)": {
    "& [data-label]": { display: "none" },
  },
});

const options: { mode: ListMode; label: string }[] = [
  { mode: "list", label: "List" },
  { mode: "table", label: "Table" },
];

/** "List | Table" for a table view on a narrow screen. */
export const ListModeToggle = (props: { state: ListModeState }) => (
  <div class={group} role="group" aria-label="Layout">
    <For each={options}>
      {(option) => (
        <button
          type="button"
          class={seg}
          aria-pressed={props.state.mode() === option.mode}
          aria-label={option.label}
          title={option.label}
          onClick={() => props.state.set(option.mode)}
        >
          {option.mode === "list" ? (
            <LayoutListIcon size={14} />
          ) : (
            <Table2Icon size={14} />
          )}
          <span data-label>{option.label}</span>
        </button>
      )}
    </For>
  </div>
);
