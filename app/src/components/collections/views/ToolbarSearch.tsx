import { SearchIcon, XIcon } from "lucide-solid";
import { Show, createSignal } from "solid-js";
import { css } from "styled-system/css";
import { noAutofill } from "~/components/ui/no-autofill";
import { useCollection } from "../CollectionContext";
import { toolbarBtn } from "./toolbar-styles";

// Same width as TOOLBAR_NARROW; Panda needs the literal in this file.
const TOOLBAR_NARROW = "@container coltoolbar (max-width: 35rem)";

const box = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "1.5",
  flexShrink: "1",
  minW: "0",
  h: "7",
  px: "2",
  borderRadius: "l2",
  color: "fg.muted",
  borderWidth: "1px",
  borderColor: "transparent",
  transition: "border-color 140ms",
  "&:focus-within": { borderColor: "border", bg: "bg.default" },
  "& input": {
    outline: "none",
    bg: "transparent",
    fontSize: "sm",
    w: "8rem",
    minW: "0",
    color: "fg.default",
  },
  "& > svg": { flexShrink: "0" },
  [TOOLBAR_NARROW]: { "[data-collapsed] &": { display: "none" } },
});
const toggle = css({
  display: "none",
  [TOOLBAR_NARROW]: { "[data-collapsed] &": { display: "inline-flex" } },
});
const wrap = css({ display: "inline-flex", minW: "0", flexShrink: "1" });

/**
 * Quick search for a view. On a narrow toolbar it folds to an icon while empty
 * and unfocused; CSS picks the form, so the server and client render the same.
 */
export const ToolbarSearch = (props: { viewId: string }) => {
  const { store } = useCollection();
  const [open, setOpen] = createSignal(false);
  let input: HTMLInputElement | undefined;
  const value = () => store.search(props.viewId);
  return (
    <span class={wrap} data-collapsed={open() || value() ? undefined : ""}>
      <button
        type="button"
        class={`${toolbarBtn} ${toggle}`}
        aria-label="Search this view"
        title="Search this view"
        onClick={() => {
          setOpen(true);
          input?.focus();
        }}
      >
        <SearchIcon size={14} />
      </button>
      <label
        class={box}
        title="Search is for this visit only. It isn't saved with the view."
      >
        <SearchIcon size={14} />
        <input
          {...noAutofill}
          ref={input}
          placeholder="Search"
          aria-label="Search this view"
          value={value()}
          onInput={(e) => store.setSearch(props.viewId, e.currentTarget.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key !== "Escape") return;
            store.setSearch(props.viewId, "");
            e.currentTarget.blur();
          }}
        />
        <Show when={value()}>
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              store.setSearch(props.viewId, "");
              input?.focus();
            }}
          >
            <XIcon size={12} />
          </button>
        </Show>
      </label>
    </span>
  );
};
