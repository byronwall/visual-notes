import { ArrowUpDownIcon } from "lucide-solid";
import { For, Show } from "solid-js";
import { css } from "styled-system/css";
import type { CommandSearchParams } from "~/components/command-search";
import * as Menu from "~/components/ui/menu";

type SortMode = CommandSearchParams["sortMode"];
type ActivityClass = CommandSearchParams["activityClass"];

const SORT_MODES: { label: string; value: SortMode }[] = [
  { label: "Relevance", value: "relevance" },
  { label: "Recent activity", value: "recent_activity" },
  { label: "Most viewed (30d)", value: "most_viewed_30d" },
  { label: "Most edited (30d)", value: "most_edited_30d" },
];

// The menu can't highlight an empty value, so "All activity" is "all" here.
const ALL_ACTIVITY = "all";

const ACTIVITY_CLASSES: { label: string; value: string }[] = [
  { label: "All activity", value: ALL_ACTIVITY },
  { label: "Read-heavy", value: "READ_HEAVY" },
  { label: "Edit-heavy", value: "EDIT_HEAVY" },
  { label: "Balanced", value: "BALANCED" },
  { label: "Cold", value: "COLD" },
];

const triggerClass = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "1",
  h: "8",
  minW: "8",
  px: "2",
  maxW: "11rem",
  borderRadius: "l2",
  fontSize: "xs",
  color: "fg.muted",
  whiteSpace: "nowrap",
  cursor: "pointer",
  transitionProperty: "background-color, color",
  transitionDuration: "140ms",
  _hover: { bg: "gray.a2", color: "fg.default" },
  _focusVisible: { outline: "2px solid", outlineColor: "gray.a8" },
  "& > svg": { flexShrink: "0" },
});
const activeLabelClass = css({ overflow: "hidden", textOverflow: "ellipsis" });
// The two groups run past the recipe's 24rem cap, which would hide "Cold".
const menuClass = css({ maxH: "var(--available-height)" });

type PaletteSortMenuProps = {
  sortMode: SortMode;
  activityClass: ActivityClass;
  onSortMode: (value: SortMode) => void;
  onActivityClass: (value: ActivityClass) => void;
};

/** One small control for note order and filter. Only a change shows a label. */
export const PaletteSortMenu = (props: PaletteSortMenuProps) => {
  const sortLabel = () =>
    SORT_MODES.find((item) => item.value === props.sortMode)?.label;
  const activityLabel = () =>
    ACTIVITY_CLASSES.find(
      (item) => item.value === (props.activityClass || ALL_ACTIVITY),
    )?.label;
  const changedLabel = () =>
    [
      props.sortMode === "relevance" ? undefined : sortLabel(),
      props.activityClass === "" ? undefined : activityLabel(),
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <Menu.Root size="sm" positioning={{ placement: "bottom-end" }}>
      <Menu.Trigger
        asChild={(triggerProps) => (
          <button
            {...triggerProps}
            type="button"
            class={triggerClass}
            aria-label={`Sort notes: ${sortLabel()}, ${activityLabel()}`}
          >
            <ArrowUpDownIcon size={14} />
            <Show when={changedLabel()}>
              {(label) => <span class={activeLabelClass}>{label()}</span>}
            </Show>
          </button>
        )}
      />
      {/* In-tree: a portal would sit outside the dialog's focus trap. */}
      <Menu.Positioner zIndex="popover">
        <Menu.Content zIndex="popover" class={menuClass}>
          <Menu.RadioItemGroup
            value={props.sortMode}
            onValueChange={(details) =>
              props.onSortMode(details.value as SortMode)
            }
          >
            <Menu.ItemGroupLabel>Sort notes</Menu.ItemGroupLabel>
            <For each={SORT_MODES}>
              {(item) => (
                <Menu.RadioItem value={item.value}>
                  <Menu.ItemText>{item.label}</Menu.ItemText>
                  <Menu.ItemIndicator />
                </Menu.RadioItem>
              )}
            </For>
          </Menu.RadioItemGroup>
          <Menu.Separator />
          <Menu.RadioItemGroup
            value={props.activityClass || ALL_ACTIVITY}
            onValueChange={(details) =>
              props.onActivityClass(
                details.value === ALL_ACTIVITY
                  ? ""
                  : (details.value as ActivityClass),
              )
            }
          >
            <Menu.ItemGroupLabel>Note activity</Menu.ItemGroupLabel>
            <For each={ACTIVITY_CLASSES}>
              {(item) => (
                <Menu.RadioItem value={item.value}>
                  <Menu.ItemText>{item.label}</Menu.ItemText>
                  <Menu.ItemIndicator />
                </Menu.RadioItem>
              )}
            </For>
          </Menu.RadioItemGroup>
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
};
