import { Show, type JSX } from "solid-js";
import { css } from "styled-system/css";
import { Button } from "~/components/ui/button";

export const sectionRoot = css({
  display: "flex",
  flexDirection: "column",
  gap: "1",
});
const head = css({
  display: "flex",
  alignItems: "center",
  gap: "2",
  minH: "7",
});
const title = css({ fontSize: "xs", color: "fg.subtle", flex: "1" });
export const sectionRow = css({
  position: "relative",
  display: "flex",
  alignItems: "flex-start",
  gap: "2",
  py: "1",
  px: "1",
  mx: "-1",
  borderRadius: "l1",
  fontSize: "sm",
  _hover: { bg: "bg.subtle" },
  "&:hover [data-row-actions], &:focus-within [data-row-actions]": {
    opacity: 1,
  },
});
export const rowMain = css({ flex: "1", minW: "0", overflowWrap: "anywhere" });
export const rowMeta = css({ fontSize: "xs", color: "fg.subtle" });
// On wide screens the actions float at the row's bottom right, beside the
// short meta line, so hidden actions never take width from the value.
export const rowActions = css({
  display: "flex",
  gap: "0.5",
  flexShrink: 0,
  md: {
    opacity: 0,
    position: "absolute",
    right: "0",
    bottom: "0",
    bg: "bg.subtle",
    borderRadius: "l1",
    boxShadow: "-8px 0 8px var(--colors-bg-subtle)",
  },
});
export const emptyText = css({ fontSize: "sm", color: "fg.subtle" });
export const inlineForm = css({
  display: "flex",
  flexDirection: "column",
  gap: "2",
  p: "2",
  borderRadius: "l2",
  borderWidth: "1px",
  borderColor: "border",
  bg: "bg.subtle",
});
export const errorText = css({ fontSize: "xs", color: "red.11" });

/** A titled block in the profile side column with an optional add action. */
export function ProfileSection(props: {
  title: string;
  addLabel?: string;
  onAdd?: () => void;
  children: JSX.Element;
}) {
  return (
    <section class={sectionRoot} aria-label={props.title}>
      <div class={head}>
        <span class={title}>{props.title}</span>
        <Show when={props.onAdd}>
          <Button size="xs" variant="plain" onClick={() => props.onAdd?.()}>
            {props.addLabel ?? "Add"}
          </Button>
        </Show>
      </div>
      {props.children}
    </section>
  );
}
