import { For } from "solid-js";
import { css } from "styled-system/css";

export const topicTabClass = css({
  px: "2",
  h: "7",
  fontSize: "sm",
  color: "fg.muted",
  borderRadius: "l1",
  cursor: "pointer",
  transitionProperty: "background-color, color",
  transitionDuration: "140ms",
  display: "inline-flex",
  alignItems: "center",
  _hover: { bg: "bg.hover", color: "fg.default" },
  "&[data-active=true]": {
    bg: "bg.selected",
    color: "fg.selected",
    fontWeight: "medium",
  },
});

export const TOPIC_VIEWS = [
  { id: "map", label: "Map" },
  { id: "board", label: "Board" },
  { id: "table", label: "Options" },
  { id: "outline", label: "Outline" },
] as const;
export type TopicView = (typeof TOPIC_VIEWS)[number]["id"];

export const parseTopicView = (value: string | undefined): TopicView =>
  TOPIC_VIEWS.find((entry) => entry.id === value)?.id ?? "map";

/** The view switch. The map is the default, so it keeps the URL clean. */
export const TopicViewTabs = (props: {
  view: TopicView;
  onView: (view: TopicView) => void;
}) => (
  <div
    role="tablist"
    aria-label="Topic view"
    class={css({ display: "flex", gap: "0.5" })}
  >
    <For each={TOPIC_VIEWS}>
      {(entry) => (
        <button
          type="button"
          role="tab"
          aria-selected={props.view === entry.id}
          class={topicTabClass}
          data-active={props.view === entry.id}
          onClick={() => props.onView(entry.id)}
        >
          {entry.label}
        </button>
      )}
    </For>
  </div>
);
