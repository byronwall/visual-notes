import { createSignal, onCleanup, onMount } from "solid-js";
import { Portal } from "solid-js/web";
import { css } from "styled-system/css";

const bubble = css({
  position: "fixed",
  zIndex: "tooltip",
  px: "2",
  py: "1",
  fontSize: "xs",
  fontWeight: "medium",
  lineHeight: "tight",
  color: "fg.error",
  bg: "bg.default",
  borderWidth: "1px",
  borderColor: "red.a7",
  borderRadius: "l2",
  boxShadow: "sm",
  whiteSpace: "nowrap",
  pointerEvents: "none",
});

/**
 * A short error under an editor. It floats in a portal so a table row keeps
 * its height and a clipping cell cannot hide it.
 */
export const FieldError = (props: {
  id: string;
  message: string;
  anchor: HTMLElement;
}) => {
  const [pos, setPos] = createSignal({ top: 0, left: 0 });
  const place = () => {
    const r = props.anchor.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left });
  };
  onMount(() => {
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    onCleanup(() => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    });
  });
  return (
    <Portal>
      <div
        id={props.id}
        class={bubble}
        role="alert"
        style={{ top: `${pos().top}px`, left: `${pos().left}px` }}
      >
        {props.message}
      </div>
    </Portal>
  );
};
