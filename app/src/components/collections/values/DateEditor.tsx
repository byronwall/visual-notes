import { Show, createSignal, untrack } from "solid-js";
import { css } from "styled-system/css";
import type { DateValue } from "~/lib/collections/types";

const panel = css({ display: "flex", flexDirection: "column", gap: "2", p: "3", w: "72", fontSize: "sm" });
const row = css({ display: "flex", alignItems: "center", gap: "2" });
const label = css({ w: "10", color: "fg.muted", fontSize: "xs" });
const field = css({
  flex: "1",
  minW: "0",
  h: "8",
  px: "2",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "l2",
  bg: "bg.default",
  fontSize: "sm",
  _focusVisible: { outline: "2px solid", outlineColor: "border.accent", outlineOffset: "-1px" },
});
const toggleRow = css({ display: "flex", alignItems: "center", gap: "2", color: "fg.muted", fontSize: "xs", cursor: "pointer" });
const footer = css({ display: "flex", justifyContent: "space-between", pt: "1" });
const linkBtn = css({ fontSize: "xs", color: "fg.muted", cursor: "pointer", _hover: { color: "fg.default" } });

const todayString = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Edits a date with an optional end date and an optional time of day. */
export const DateEditor = (props: {
  value: DateValue | null;
  includeTime: boolean;
  onChange: (value: DateValue | null) => void;
  onDone: () => void;
}) => {
  const [hasEnd, setHasEnd] = createSignal(untrack(() => Boolean(props.value?.end)));
  const inputType = () => (props.includeTime ? "datetime-local" : "date");
  const fit = (v: string | undefined | null) =>
    !v ? "" : props.includeTime ? (v.length === 10 ? `${v}T09:00` : v) : v.slice(0, 10);

  const emit = (start: string, end: string | null) => {
    if (!start) {
      props.onChange(null);
      return;
    }
    const normalizedEnd = end && end >= start ? end : null;
    props.onChange(normalizedEnd ? { start, end: normalizedEnd } : { start });
  };

  return (
    <div
      class={panel}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          props.onDone();
        }
      }}
    >
      <div class={row}>
        <span class={label}>{hasEnd() ? "Start" : "Date"}</span>
        <input
          class={field}
          type={inputType()}
          value={fit(props.value?.start)}
          aria-label="Start date"
          autofocus
          onChange={(e) => emit(e.currentTarget.value, hasEnd() ? fit(props.value?.end) || null : null)}
        />
      </div>
      <Show when={hasEnd()}>
        <div class={row}>
          <span class={label}>End</span>
          <input
            class={field}
            type={inputType()}
            value={fit(props.value?.end)}
            min={fit(props.value?.start)}
            aria-label="End date"
            onChange={(e) => emit(fit(props.value?.start) || e.currentTarget.value, e.currentTarget.value || null)}
          />
        </div>
      </Show>
      <label class={toggleRow}>
        <input
          type="checkbox"
          checked={hasEnd()}
          onChange={(e) => {
            setHasEnd(e.currentTarget.checked);
            if (!e.currentTarget.checked && props.value) emit(props.value.start, null);
          }}
        />
        End date
      </label>
      <div class={footer}>
        <button type="button" class={linkBtn} onClick={() => emit(fit(todayString()), null)}>
          Today
        </button>
        <button
          type="button"
          class={linkBtn}
          onClick={() => {
            props.onChange(null);
            props.onDone();
          }}
        >
          Clear
        </button>
      </div>
    </div>
  );
};
