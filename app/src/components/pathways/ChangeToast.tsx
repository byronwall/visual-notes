import { Show } from "solid-js";
import { css } from "styled-system/css";
import { usePathway } from "./pathway-state";
import { help, iconX, textButton } from "./styles";

// Floats over the map's top-right corner, beside the side panel, so it
// moves nothing when it appears or goes.
const toast = css({
  position: "absolute",
  top: "3",
  right: "calc(380px + token(spacing.3))",
  zIndex: "docked",
  w: "340px",
  maxW: "calc(100% - 380px - token(spacing.6))",
  display: "flex",
  flexDirection: "column",
  gap: "1",
  px: "3",
  py: "2",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "lg",
  bg: "bg.default",
  boxShadow: "md",
});
const head = css({ display: "flex", alignItems: "center", gap: "2" });
const summary = css({
  m: "0",
  fontSize: "xs",
  lineHeight: "1.45",
});

/** What the last agent run (or outside edit) changed, until the next change or ×. */
export function ChangeToast() {
  const s = usePathway();
  const counts = () => {
    const c = s.change()!;
    return [
      c.added.length && `${c.added.length} added`,
      c.joined.length && `${c.joined.length} joined`,
      c.dropped?.length && `${c.dropped.length} dropped`,
      c.removed.length && `${c.removed.length} merged away`,
      c.questions && `${c.questions} new questions`,
      c.planned && `${c.planned} next steps`,
    ]
      .filter(Boolean)
      .join(" · ");
  };

  return (
    <Show when={s.change()}>
      {(c) => (
        <div class={toast} role="status">
          <div class={head}>
            <strong
              class={css({
                flex: "1",
                minW: "0",
                truncate: true,
                fontSize: "sm",
              })}
            >
              ✦ {c().label}
            </strong>
            <Show when={c().ms}>
              <span class={help}>{(c().ms! / 1000).toFixed(1)}s</span>
            </Show>
            <button class={textButton} onClick={() => s.setView("activity")}>
              Activity
            </button>
            <button
              class={iconX}
              title="Clear the highlights"
              onClick={() => s.setChange(null)}
            >
              ×
            </button>
          </div>
          <Show when={c().summary}>
            <p class={summary}>{c().summary}</p>
          </Show>
          <p class={help}>
            {counts() || "Nothing on the map changed."}
            <Show when={c().added.length || c().joined.length}>
              . New cards are outlined in blue.
            </Show>
          </p>
        </div>
      )}
    </Show>
  );
}
