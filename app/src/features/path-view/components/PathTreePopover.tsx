import { ListTreeIcon } from "lucide-solid";
import { createSignal } from "solid-js";
import { css } from "styled-system/css";
import { IconButton } from "~/components/ui/icon-button";
import { SimplePopover } from "~/components/ui/simple-popover";
import type { PathTreeNode } from "../utils/path-tree";
import { PathTreeRail } from "./PathTreeRail";

/** The tree rail as a popover, for widths where the rail itself is hidden. */
export const PathTreePopover = (props: { tree: PathTreeNode; activePath: string }) => {
  const [open, setOpen] = createSignal(false);
  let railEl: HTMLElement | undefined;
  let buttonEl: HTMLButtonElement | undefined;
  // The popover hangs off an Anchor (not a Trigger), so Ark does not hand
  // focus back on close; do it here when focus would otherwise drop to body.
  const close = () => {
    const hadFocus = !!railEl?.contains(document.activeElement);
    setOpen(false);
    requestAnimationFrame(() => {
      if (hadFocus || document.activeElement === document.body) buttonEl?.focus();
    });
  };

  return (
    <SimplePopover
      open={open()}
      onClose={close}
      // Open on the current row so arrows and typeahead work right away.
      initialFocusEl={() =>
        railEl?.querySelector<HTMLElement>("[role=treeitem][tabindex='0']") ?? null
      }
      placement="bottom-start"
      offset={6}
      class={css({
        p: "2",
        minW: "260px",
        maxW: "calc(100vw - 32px)",
        maxH: "min(70vh, 560px)",
        overflowY: "auto",
        overscrollBehavior: "contain",
      })}
      anchor={
        <IconButton
          ref={buttonEl}
          size="sm"
          variant="plain"
          aria-label="Browse paths"
          title="Browse paths"
          aria-expanded={open()}
          onClick={() => setOpen(!open())}
          color="fg.muted"
          _hover={{ color: "fg.default" }}
        >
          <ListTreeIcon size={16} />
        </IconButton>
      }
    >
      <PathTreeRail
        ref={(el) => (railEl = el)}
        tree={props.tree}
        activePath={props.activePath}
        onNavigate={close}
      />
    </SimplePopover>
  );
};
