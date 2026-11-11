import {
  Show,
  createComputed,
  createMemo,
  createSignal,
  on,
  onMount,
  type ComponentProps,
} from "solid-js";
import { SimplePopover } from "~/components/ui/simple-popover";

type Props = ComponentProps<typeof SimplePopover>;

const FOCUSABLE = "button, [href], input, [tabindex]";
/** How long after an Escape close a lost focus is still put back. */
const RESTORE_WATCH_MS = 300;

/**
 * A SimplePopover that builds its popover machine and portal only once it
 * first opens. Until then it renders the anchor in a plain wrapper with the
 * same class. Table cells and board cards each carry a popover, so this keeps
 * hundreds of closed popovers out of every row mount.
 *
 * Escape returns focus to whatever had it when the popover opened (a cell or
 * a menu button); the popover has no trigger part to restore focus to.
 */
export const LazyPopover = (props: Props) => {
  let plain: HTMLDivElement | undefined;
  // The anchor is rebuilt when the popover arms; a trigger that had focus
  // gets it back so Escape and close return focus to it.
  let refocus = false;
  const armed = createMemo<boolean>((was) => {
    if (was || !props.open) return was;
    refocus = Boolean(plain?.contains(document.activeElement));
    return true;
  }, false);
  return (
    <Show
      when={armed()}
      fallback={
        <div ref={plain} class={props.anchorClass}>
          {props.anchor}
        </div>
      }
    >
      <ArmedPopover {...props} refocus={refocus} />
    </Show>
  );
};

/** Mounts closed, then opens in the same tick, like a popover that was always there. */
const ArmedPopover = (props: Props & { refocus: boolean }) => {
  let box: HTMLDivElement | undefined;
  const [ready, setReady] = createSignal(false);
  onMount(() => {
    if (props.refocus) box?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    // After the popover's own mount effects, which start its state machine;
    // an open that arrives before that start is lost.
    queueMicrotask(() => setReady(true));
  });
  const open = () => props.open && ready();

  let opener: HTMLElement | null = null;
  let escaped = false;
  // Runs before the popover moves focus into its content.
  createComputed(
    on(open, (isOpen, wasOpen) => {
      if (isOpen && !wasOpen) {
        const active = document.activeElement;
        opener =
          active instanceof HTMLElement && active !== document.body
            ? active
            : null;
      } else if (!isOpen && wasOpen && escaped) {
        escaped = false;
        const el = opener;
        const restore = () => el?.isConnected && el.focus();
        queueMicrotask(restore);
        // An Escape right after opening can beat the popover's own late move
        // of focus into its content; removing that content then drops focus
        // on the body. Catch that for a moment and restore again.
        const onOut = (e: FocusEvent) => {
          if (!e.relatedTarget)
            queueMicrotask(
              () => document.activeElement === document.body && restore(),
            );
        };
        document.addEventListener("focusout", onOut, true);
        setTimeout(
          () => document.removeEventListener("focusout", onOut, true),
          RESTORE_WATCH_MS,
        );
      }
    }),
  );

  // display: contents keeps the wrapper out of layout; the content portals out.
  return (
    <div ref={box} style={{ display: "contents" }}>
      <SimplePopover
        {...props}
        open={open()}
        onEscapeKeyDown={(event) => {
          props.onEscapeKeyDown?.(event);
          if (!event.defaultPrevented) escaped = true;
        }}
      />
    </div>
  );
};
