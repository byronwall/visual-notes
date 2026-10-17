import type { JSX } from "solid-js";
import { css } from "styled-system/css";

type Props = {
  title: string;
  compact?: boolean;
  children?: JSX.Element;
};

export const TaskEmptyState = (props: Props) => (
  <div
    data-testid="task-empty-state"
    class={css({
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      gap: "2",
      py: "6",
      pl: "2",
      "&[data-compact=false]": { py: "16", alignItems: "center", textAlign: "center", pl: "0" },
    })}
    data-compact={props.compact ? "true" : "false"}
  >
    <p class={css({ fontSize: "sm", fontWeight: "medium", color: "fg.default" })}>{props.title}</p>
    <div class={css({ fontSize: "sm", color: "fg.muted" })}>{props.children}</div>
  </div>
);
