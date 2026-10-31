import { CheckIcon, SunriseIcon } from "lucide-solid";
import { Show } from "solid-js";
import { css } from "styled-system/css";

export const rowSwipeClass = css({
  position: "relative",
  overflow: "hidden",
  borderRadius: "l2",
});

const backClass = css({
  position: "absolute",
  inset: "0",
  display: "flex",
  alignItems: "center",
  gap: "1.5",
  px: "4",
  fontSize: "sm",
  fontWeight: "medium",
  "&[data-side=done]": { bg: "green.a3", color: "green.11" },
  "&[data-side=later]": {
    justifyContent: "flex-end",
    bg: "amber.a3",
    color: "amber.11",
  },
  "&[data-armed=true][data-side=done]": { bg: "green.a5" },
  "&[data-armed=true][data-side=later]": { bg: "amber.a5" },
});

/** What a swipe will do, shown behind the moving row. */
export const TaskRowSwipeBack = (props: { dx: number; armed: boolean }) => (
  <Show when={props.dx !== 0}>
    <div
      class={backClass}
      aria-hidden="true"
      data-side={props.dx > 0 ? "done" : "later"}
      data-armed={props.armed ? "true" : "false"}
    >
      <Show
        when={props.dx > 0}
        fallback={
          <>
            Tomorrow
            <SunriseIcon size={16} />
          </>
        }
      >
        <CheckIcon size={16} />
        Done
      </Show>
    </div>
  </Show>
);
