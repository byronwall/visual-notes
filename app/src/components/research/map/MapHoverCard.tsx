import { createSignal, onCleanup, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { css } from "styled-system/css";
import type { MapTree } from "./map-model";

const HOVER_DELAY_MS = 200;
const GAP = 6;
const CARD_MAX_W = 352;

type Hover = { title: string; goal: string; left: number; top: number };

/**
 * One card for the whole map, not one per node: it shows a title cut off by the
 * clamp, or a stream's goal. It stays away when it would only repeat the node.
 */
export const createMapHover = (tree: () => MapTree) => {
  const [hover, setHover] = createSignal<Hover | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));

  const hide = () => {
    clearTimeout(timer);
    setHover(null);
  };
  const show = (element: HTMLElement) => {
    const node = tree().byId.get(element.dataset.nodeId ?? "");
    if (!node) return;
    const labels = element.querySelectorAll<HTMLElement>("[data-map-title]");
    const cut = [...labels].some(
      (label) => label.scrollHeight > label.clientHeight + 1,
    );
    // A stream's goal shows nowhere else on the map; the root's answer does.
    const goal = cut || node.kind === "stream" ? node.goal ?? "" : "";
    if (!cut && !goal) return;
    const rect = element.getBoundingClientRect();
    setHover({
      title: node.title,
      goal,
      left: Math.min(rect.left, window.innerWidth - CARD_MAX_W - GAP),
      top: rect.bottom + GAP,
    });
  };
  const nodeAt = (target: EventTarget | null) =>
    (target as HTMLElement | null)?.closest<HTMLElement>("[data-node-id]") ??
    null;

  return {
    hide,
    onPointerOver: (event: PointerEvent) => {
      const element = nodeAt(event.target);
      hide();
      if (element) timer = setTimeout(() => show(element), HOVER_DELAY_MS);
    },
    onFocusIn: (event: FocusEvent) => {
      const element = nodeAt(event.target);
      if (element?.matches(":focus-visible")) show(element);
    },
    Card: () => (
      <Show when={hover()}>
        {(entry) => (
          <Portal>
            <div
              role="tooltip"
              data-testid="research-map-hover"
              class={css({
                position: "fixed",
                zIndex: "tooltip",
                px: "2.5",
                py: "1.5",
                bg: "bg.default",
                color: "fg.default",
                fontSize: "sm",
                lineHeight: "1.35",
                borderRadius: "l2",
                boxShadow: "md",
                pointerEvents: "none",
              })}
              style={{
                left: `${entry().left}px`,
                top: `${entry().top}px`,
                "max-width": `${CARD_MAX_W}px`,
              }}
            >
              <div class={css({ fontWeight: "medium" })}>{entry().title}</div>
              <Show when={entry().goal}>
                <div class={css({ color: "fg.muted", mt: "0.5" })}>
                  {entry().goal}
                </div>
              </Show>
            </div>
          </Portal>
        )}
      </Show>
    ),
  };
};
