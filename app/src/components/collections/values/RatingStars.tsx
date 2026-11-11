import { For, Show } from "solid-js";
import { css } from "styled-system/css";
import { optionInk } from "~/lib/collections/colors";

const row = css({
  display: "inline-flex",
  alignItems: "center",
  lineHeight: "1",
});
const star = css({
  fontSize: "sm",
  color: "border.emphasized",
  // Ochre ink from the option palette, not a UI warning yellow.
  "&[data-on]": { color: "var(--star-on)" },
});
// A 24px target around the same small glyph.
const starButton = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  boxSize: "6",
  p: "0",
  bg: "transparent",
  border: "none",
  borderRadius: "l1",
  cursor: "pointer",
  outline: "none",
  "& > span": { transition: "transform 80ms" },
  _hover: { "& > span": { transform: "scale(1.15)" } },
  _focusVisible: { boxShadow: "inset 0 0 0 2px token(colors.border.accent)" },
  "@media (prefers-reduced-motion: reduce)": {
    _hover: { "& > span": { transform: "none" } },
  },
});
const readOnlyRow = css({ gap: "0.5" });

/**
 * Stars for the rating number format. With `onChange` they are a radio group:
 * one tab stop, arrows change the value, and choosing the current value
 * clears it.
 */
export const RatingStars = (props: {
  value: number;
  max: number;
  label?: string;
  onChange?: (value: number | null) => void;
}) => {
  const stars = () => Array.from({ length: props.max }, (_, i) => i + 1);
  let group: HTMLSpanElement | undefined;

  const move = (to: number) => {
    const next = Math.max(1, Math.min(props.max, to));
    if (next !== props.value) props.onChange!(next);
    group
      ?.querySelectorAll<HTMLButtonElement>("[role=radio]")
      [next - 1]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const step =
      e.key === "ArrowRight" || e.key === "ArrowUp"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowDown"
          ? -1
          : 0;
    if (step) {
      e.preventDefault();
      e.stopPropagation();
      move((props.value || (step > 0 ? 0 : 1)) + step);
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      e.stopPropagation();
      move(e.key === "Home" ? 1 : props.max);
    } else if (e.key === "Enter" || e.key === " ") {
      // The button handles these; the cell around it must not.
      e.stopPropagation();
    }
  };

  return (
    <Show
      when={props.onChange}
      fallback={
        <span
          class={`${row} ${readOnlyRow}`}
          style={{ "--star-on": optionInk("yellow") }}
          role="img"
          aria-label={`Rating ${props.value} of ${props.max}`}
        >
          <For each={stars()}>
            {(n) => (
              <span class={star} data-on={n <= props.value ? "" : undefined}>
                ★
              </span>
            )}
          </For>
        </span>
      }
    >
      <span
        ref={group}
        class={row}
        style={{ "--star-on": optionInk("yellow") }}
        role="radiogroup"
        aria-label={props.label ?? "Rating"}
        onKeyDown={onKeyDown}
      >
        <For each={stars()}>
          {(n) => (
            <button
              type="button"
              role="radio"
              class={starButton}
              aria-checked={n === props.value}
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              tabIndex={n === (props.value || 1) ? 0 : -1}
              onClick={(e) => {
                e.stopPropagation();
                props.onChange!(n === props.value ? null : n);
              }}
            >
              <span class={star} data-on={n <= props.value ? "" : undefined}>
                ★
              </span>
            </button>
          )}
        </For>
      </span>
    </Show>
  );
};
