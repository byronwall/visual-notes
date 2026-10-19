import { createContext, createSignal, onCleanup, useContext, type JSX } from "solid-js";

export type PathHoverPlacement = "bottom-start" | "right-start";

export type PathHoverInfo = {
  path: string;
  meta?: string;
  placement?: PathHoverPlacement;
  /** The clipped element, when it is not the trigger itself. */
  clippedSelector?: string;
};

export type PathHoverState = PathHoverInfo & { anchor: HTMLElement };

/** Pointer/focus handlers to spread onto a trigger link. */
export type PathHoverTriggerProps = Pick<
  JSX.HTMLAttributes<HTMLAnchorElement>,
  "onPointerEnter" | "onPointerLeave" | "onFocus" | "onBlur"
>;

const OPEN_DELAY_MS = 350;
const CLOSE_DELAY_MS = 100;

const isClipped = (trigger: HTMLElement, selector?: string) => {
  const el = selector ? trigger.querySelector<HTMLElement>(selector) : trigger;
  return !!el && el.scrollWidth > el.clientWidth + 1;
};

/**
 * One hover card per page, shared by every path link. Rows only carry cheap
 * pointer/focus handlers; mounting a hover-card state machine per row doubled
 * render cost for long lists and filtered trees.
 */
export const createPathHoverCard = () => {
  const [state, setState] = createSignal<PathHoverState | null>(null);
  let openTimer: ReturnType<typeof setTimeout> | undefined;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => {
    clearTimeout(openTimer);
    clearTimeout(closeTimer);
  });

  const show = (anchor: HTMLElement, info: PathHoverInfo) => {
    clearTimeout(closeTimer);
    clearTimeout(openTimer);
    if (state()?.anchor === anchor) return;
    if (!isClipped(anchor, info.clippedSelector)) return;
    // Moving between rows while a card is up switches it without a second wait.
    const delay = state() ? 0 : OPEN_DELAY_MS;
    openTimer = setTimeout(() => setState({ ...info, anchor }), delay);
  };
  const hide = (immediate = false) => {
    clearTimeout(openTimer);
    clearTimeout(closeTimer);
    if (immediate) setState(null);
    else closeTimer = setTimeout(() => setState(null), CLOSE_DELAY_MS);
  };
  const keepOpen = () => clearTimeout(closeTimer);

  const triggerProps = (info: () => PathHoverInfo): PathHoverTriggerProps => ({
    onPointerEnter: (event) => {
      if (event.pointerType !== "touch") show(event.currentTarget, info());
    },
    onPointerLeave: () => hide(),
    onFocus: (event) => {
      if (event.currentTarget.matches(":focus-visible")) show(event.currentTarget, info());
    },
    onBlur: () => hide(true),
  });

  return { state, hide, keepOpen, triggerProps };
};

export type PathHoverCardApi = ReturnType<typeof createPathHoverCard>;

export const PathHoverCardContext = createContext<PathHoverCardApi>();

export const usePathHoverTrigger = (info: () => PathHoverInfo): PathHoverTriggerProps =>
  useContext(PathHoverCardContext)?.triggerProps(info) ?? {};
