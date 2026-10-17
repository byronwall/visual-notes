import { onMount } from "solid-js";
import { css, cx } from "styled-system/css";
import { BlockFace } from "./BlockFace";
import { blockShell, type BlockGeometry } from "./TimeBlockCard";

export type DraftRange = { start: Date; end: Date; color: string };

type Props = {
  draft: DraftRange;
  geometry: BlockGeometry;
  saving: boolean;
  onCommit: (title: string) => void;
  onCancel: () => void;
  onExpand: (title: string) => void;
};

const draftShell = css({
  zIndex: 2,
  outline: "2px solid var(--colors-fg-default)",
  outlineOffset: "1px",
  boxShadow: "0 6px 18px var(--colors-black-a4)",
});

const titleInput = css({
  all: "unset",
  w: "full",
  minW: "0",
  fontWeight: "semibold",
  color: "white",
  "&::placeholder": { color: "white", opacity: 0.7 },
});

/** A freshly drawn block waiting for its title; Enter saves, Esc discards. */
export const DraftBlock = (props: Props) => {
  let inputRef: HTMLInputElement | undefined;
  let settled = false;

  onMount(() => {
    // Focus after the pointerup that created the draft has finished.
    requestAnimationFrame(() => inputRef?.focus());
  });

  const settle = (action: () => void) => {
    if (settled) return;
    settled = true;
    action();
  };

  const input = (
    <input
      ref={inputRef}
      class={titleInput}
      data-testid="time-block-draft-input"
      aria-label="New block title"
      placeholder="New block"
      disabled={props.saving}
      onKeyDown={(event) => {
        event.stopPropagation();
        const title = event.currentTarget.value.trim();
        if (event.key === "Escape") {
          event.preventDefault();
          settle(props.onCancel);
        } else if (
          event.key === "Enter" &&
          (event.shiftKey || event.metaKey || event.ctrlKey)
        ) {
          event.preventDefault();
          settle(() => props.onExpand(title));
        } else if (event.key === "Enter") {
          event.preventDefault();
          settle(() => props.onCommit(title));
        }
      }}
      onBlur={(event) => {
        const title = event.currentTarget.value.trim();
        settle(() => (title ? props.onCommit(title) : props.onCancel()));
      }}
    />
  );

  return (
    <div
      class={cx(blockShell, draftShell)}
      data-time-block="true"
      data-testid="time-block-draft"
      style={{
        "background-color": props.draft.color,
        left: props.geometry.left,
        width: props.geometry.width,
        top: `${props.geometry.top}px`,
        height: `${props.geometry.height}px`,
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <BlockFace
        title={input}
        start={props.draft.start}
        end={props.draft.end}
        heightPx={props.geometry.height}
        showDuration
      />
    </div>
  );
};
