import { Show } from "solid-js";
import { css } from "styled-system/css";
import type { FoldNode } from "../layout/fold";
import type { Rect } from "../layout/tree-layout";
import { CARD_STATE_META, CardTypeIcon } from "../cardTypeMeta";

const hostOf = (url: string) => {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/** Markdown-ish body to one plain line for the card preview. */
const plainPreview = (markdown: string) =>
  markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const shellClass = css({
  position: "absolute",
  transitionProperty: "left, top, opacity",
  transitionDuration: "200ms",
  transitionTimingFunction: "cubic-bezier(0.2, 0, 0, 1)",
  "&[data-dragging=true]": { transitionProperty: "none", zIndex: 2 },
  "&[data-faded=true]": { opacity: 0.5 },
  "&[data-dimmed=true]": { opacity: 0.18 },
  "@media (prefers-reduced-motion: reduce)": { transitionProperty: "none" },
});

const cardClass = css({
  position: "absolute",
  top: 0,
  left: 0,
  transformOrigin: "0 0",
  display: "flex",
  flexDirection: "column",
  gap: "1",
  px: "2.5",
  py: "2",
  bg: "bg.default",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "l2",
  overflow: "hidden",
  cursor: "pointer",
  userSelect: "none",
  transitionProperty: "border-color, box-shadow",
  transitionDuration: "140ms",
  _hover: { borderColor: "gray.a8" },
  "&[data-kind=summary]": { bg: "gray.2", borderColor: "gray.a6" },
  "&[data-selected=true]": { borderColor: "border.selected", boxShadow: "0 0 0 1px token(colors.border.selected)" },
  "&[data-open=true]": { borderColor: "amber.a7" },
});

const clamp2 = css({ lineClamp: 2 });
const clamp3 = css({ lineClamp: 3 });
const clamp4 = css({ lineClamp: 4 });

export const CanvasCardNode = (props: {
  node: FoldNode;
  rect: Rect;
  factor: number;
  selected: boolean;
  dimmed: boolean;
  dragging: boolean;
  onPointerDown: (event: PointerEvent) => void;
}) => {
  const card = () => props.node.card;
  const summary = () => props.node.kind === "summary";
  const preview = () => plainPreview(card().body || card().snippet || "");

  return (
    <div
      class={shellClass}
      style={{
        left: `${props.rect.x}px`,
        top: `${props.rect.y}px`,
        width: `${props.rect.w}px`,
        height: `${props.rect.h}px`,
      }}
      data-faded={props.node.faded}
      data-dimmed={props.dimmed}
      data-dragging={props.dragging}
    >
      <div
        class={cardClass}
        style={{
          width: `${props.rect.w / props.factor}px`,
          height: `${props.rect.h / props.factor}px`,
          transform: props.factor === 1 ? undefined : `scale(${props.factor})`,
        }}
        data-kind={props.node.kind}
        data-selected={props.selected}
        data-open={card().state === "open"}
        data-testid="research-canvas-card"
        data-card-id={card().id}
        role="button"
        tabIndex={0}
        aria-label={`${card().type}: ${card().title}`}
        onPointerDown={(event) => props.onPointerDown(event)}
      >
        <div class={css({ display: "flex", gap: "1.5", alignItems: "flex-start" })}>
          <span class={css({ display: "inline-flex", pt: "0.5" })}>
            <Show when={card().state} fallback={<CardTypeIcon type={card().type} />}>
              {(state) => (
                <span
                  class={css({ display: "inline-flex", color: state() === "open" ? "amber.11" : state() === "done" ? "green.11" : "fg.muted" })}
                  aria-label={CARD_STATE_META[state()].label}
                >
                  {CARD_STATE_META[state()].icon({ size: 14, strokeWidth: 2 })}
                </span>
              )}
            </Show>
          </span>
          <span
            class={`${clamp3} ${css({
              fontSize: "13px",
              lineHeight: "18px",
              fontWeight: summary() ? "semibold" : "normal",
              textDecoration: card().state === "dropped" ? "line-through" : undefined,
            })}`}
          >
            {card().title}
          </span>
        </div>
        <Show when={preview()}>
          <p class={`${summary() ? clamp4 : clamp2} ${css({ fontSize: "12px", lineHeight: "16px", color: "fg.muted" })}`}>
            {preview()}
          </p>
        </Show>
        <Show when={card().url}>
          {(url) => (
            <span class={css({ fontSize: "12px", color: "fg.link", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" })}>
              {hostOf(url())}
            </span>
          )}
        </Show>
        <Show when={!summary() && card().imageUrl}>
          {(src) => (
            <img
              src={src()}
              alt=""
              loading="lazy"
              draggable={false}
              class={css({ h: "16", w: "full", objectFit: "cover", borderRadius: "l1" })}
            />
          )}
        </Show>
        <Show when={summary()}>
          <span class={css({ mt: "auto", fontSize: "11px", color: "fg.muted", fontVariantNumeric: "tabular-nums" })}>
            {props.node.coveredCount} cards folded
            <Show when={props.node.openInside > 0}>
              {" · "}
              <span class={css({ color: "amber.11" })}>{props.node.openInside} open shown</span>
            </Show>
          </span>
        </Show>
      </div>
    </div>
  );
};
