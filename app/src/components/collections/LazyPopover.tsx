import {
  Show,
  createMemo,
  createSignal,
  onMount,
  type ComponentProps,
} from "solid-js";
import { SimplePopover } from "~/components/ui/simple-popover";

type Props = ComponentProps<typeof SimplePopover>;

const FOCUSABLE = "button, [href], input, [tabindex]";

/**
 * A SimplePopover that builds its popover machine and portal only once it
 * first opens. Until then it renders the anchor in a plain wrapper with the
 * same class. Table cells and board cards each carry a popover, so this keeps
 * hundreds of closed popovers out of every row mount.
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
  // display: contents keeps the wrapper out of layout; the content portals out.
  return (
    <div ref={box} style={{ display: "contents" }}>
      <SimplePopover {...props} open={props.open && ready()} />
    </div>
  );
};
