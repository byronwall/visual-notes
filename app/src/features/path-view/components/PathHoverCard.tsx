import { For, Show, createEffect, createSignal, onCleanup, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { css, cx } from "styled-system/css";
import { hoverCard } from "styled-system/recipes";
import {
  PathHoverCardContext,
  createPathHoverCard,
  usePathHoverTrigger,
  type PathHoverInfo,
  type PathHoverState,
  type PathHoverTriggerProps,
} from "../hooks/usePathHoverCard";

const GAP = 6;
const EDGE = 8;

const contentClass = css({
  position: "fixed",
  // Content-sized, capped to the viewport for very long paths.
  maxW: "min(420px, calc(100vw - 32px))",
  px: "3",
  py: "2",
  gap: "1",
  pointerEvents: "auto",
});

const pathClass = css({
  fontFamily: "mono",
  fontSize: "13px",
  lineHeight: "1.45",
  color: "fg.muted",
  overflowWrap: "anywhere",
  "& [data-leaf]": { color: "fg.default", fontWeight: "medium" },
});

const metaClass = css({
  fontSize: "xs",
  color: "fg.subtle",
  fontVariantNumeric: "tabular-nums",
});

/** Place the card beside its anchor, flipping/clamping to stay on screen. */
const placeCard = (state: PathHoverState, card: DOMRect) => {
  const a = state.anchor.getBoundingClientRect();
  const maxLeft = innerWidth - card.width - EDGE;
  const maxTop = innerHeight - card.height - EDGE;
  if (state.placement === "right-start" && a.right + GAP + card.width <= innerWidth - EDGE) {
    return { top: Math.max(EDGE, Math.min(a.top, maxTop)), left: a.right + GAP };
  }
  const below = a.bottom + GAP;
  const top = below + card.height <= innerHeight - EDGE ? below : a.top - GAP - card.height;
  return {
    top: Math.max(EDGE, Math.min(top, maxTop)),
    left: Math.max(EDGE, Math.min(a.left, maxLeft)),
  };
};

const PathHoverCardSurface = (props: {
  state: PathHoverState;
  onEnter: () => void;
  onLeave: () => void;
}) => {
  const [pos, setPos] = createSignal<{ top: number; left: number } | null>(null);
  let cardEl: HTMLDivElement | undefined;
  const segments = () => props.state.path.split(".");

  createEffect(() => {
    const state = props.state;
    setPos(null);
    queueMicrotask(() => cardEl && setPos(placeCard(state, cardEl.getBoundingClientRect())));
  });

  return (
    <div
      ref={cardEl}
      role="tooltip"
      data-state="open"
      class={cx(hoverCard().content, contentClass)}
      // Runtime geometry goes inline (AGENTS: no dynamic classes for positions).
      style={{
        top: `${pos()?.top ?? 0}px`,
        left: `${pos()?.left ?? 0}px`,
        visibility: pos() ? "visible" : "hidden",
      }}
      data-path-hover-card
      onPointerEnter={() => props.onEnter()}
      onPointerLeave={() => props.onLeave()}
    >
      <p class={pathClass}>
        <For each={segments()}>
          {(segment, index) => (
            <>
              <Show when={index() > 0}>
                .<wbr />
              </Show>
              <span data-leaf={index() === segments().length - 1 ? "" : undefined}>{segment}</span>
            </>
          )}
        </For>
      </p>
      <Show when={props.state.meta}>
        <p class={metaClass}>{props.state.meta}</p>
      </Show>
    </div>
  );
};

/** Hosts the single shared path hover card for everything rendered inside it. */
export const PathHoverCardProvider = (props: { children: JSX.Element }) => {
  const api = createPathHoverCard();

  createEffect(() => {
    if (!api.state()) return;
    const close = () => api.hide(true);
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && close();
    window.addEventListener("scroll", close, { capture: true, passive: true });
    window.addEventListener("pointerdown", close, { capture: true });
    window.addEventListener("keydown", onKey);
    onCleanup(() => {
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("pointerdown", close, { capture: true });
      window.removeEventListener("keydown", onKey);
    });
  });

  return (
    <PathHoverCardContext.Provider value={api}>
      {props.children}
      {/* Only ever set by pointer/focus after hydration, so SSR renders nothing here. */}
      <Show when={api.state()}>
        {(state) => (
          <Portal>
            <PathHoverCardSurface
              state={state()}
              onEnter={api.keepOpen}
              onLeave={() => api.hide()}
            />
          </Portal>
        )}
      </Show>
    </PathHoverCardContext.Provider>
  );
};

/**
 * Shows the full dotted path when a mono path is clipped by an ellipsis.
 * Untruncated paths never open the card, so short rows stay quiet.
 */
export const PathHoverCard = (
  props: PathHoverInfo & { children: (triggerProps: PathHoverTriggerProps) => JSX.Element },
) => {
  const triggerProps = usePathHoverTrigger(() => ({
    path: props.path,
    meta: props.meta,
    placement: props.placement,
    clippedSelector: props.clippedSelector,
  }));
  return <>{props.children(triggerProps)}</>;
};
