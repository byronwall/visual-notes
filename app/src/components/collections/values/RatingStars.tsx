import { For } from "solid-js";
import { css } from "styled-system/css";

const row = css({ display: "inline-flex", alignItems: "center", gap: "0.5", lineHeight: "1" });
const star = css({
  fontSize: "sm",
  color: "border.emphasized",
  bg: "transparent",
  p: "0",
  border: "none",
  cursor: "inherit",
  "&[data-on]": { color: "amber.9" },
  "&:is(button)": { cursor: "pointer", _hover: { transform: "scale(1.15)" } },
  transition: "transform 80ms",
});

/** Stars for the rating number format. Interactive when `onChange` is set. */
export const RatingStars = (props: {
  value: number;
  max: number;
  onChange?: (value: number | null) => void;
}) => (
  <span class={row} role={props.onChange ? "radiogroup" : "img"} aria-label={`Rating ${props.value} of ${props.max}`}>
    <For each={Array.from({ length: props.max }, (_, i) => i + 1)}>
      {(n) =>
        props.onChange ? (
          <button
            type="button"
            class={star}
            data-on={n <= props.value ? "" : undefined}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            onClick={(e) => {
              e.stopPropagation();
              props.onChange!(n === props.value ? null : n);
            }}
          >
            ★
          </button>
        ) : (
          <span class={star} data-on={n <= props.value ? "" : undefined}>
            ★
          </span>
        )
      }
    </For>
  </span>
);
