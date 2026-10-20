import { Show, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { css } from "styled-system/css";
import { XIcon } from "lucide-solid";
import * as Dialog from "~/components/ui/dialog";
import { WrapWhen } from "./WrapWhen";

type SimpleDialogProps = {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  title?: string;
  description?: string;
  header?: JSX.Element;
  footer?: JSX.Element;
  children?: JSX.Element;
  maxW?: string;
  contentClass?: string;
  showClose?: boolean;
  closeLabel?: string;
  skipPortal?: boolean;
  initialFocusEl?: () => HTMLElement | null;
  restoreFocus?: boolean;
  /** Set false for dialogs holding typed input so a stray click can't drop it. */
  closeOnInteractOutside?: boolean;
  /**
   * Below the md breakpoint, fill the visible screen like a native sheet and
   * move the footer actions to the top, where the keyboard can't cover them.
   */
  phoneSheet?: boolean;
  /** Call `event.preventDefault()` to keep the dialog open, e.g. for an inner combobox. */
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
};

// Sized from the visual viewport (see ~/lib/visual-viewport) so the open iOS
// keyboard never pushes the top actions out of view. Condition styles sort
// after the base maxW/maxH below, so these win on phones.
const phoneSheetClass = css({
  mdDown: {
    w: "100vw",
    maxW: "100vw",
    h: "var(--vv-height, 100dvh)",
    maxH: "var(--vv-height, 100dvh)",
    mt: "var(--vv-top, 0px)",
    mb: "0",
    borderRadius: "0",
    boxShadow: "none",
    pt: "2",
    gap: "3",
    "& .dialog__footer": { order: -1, pb: "0" },
    "& .dialog__closeTrigger": { display: "none" },
  },
});

export function SimpleDialog(props: SimpleDialogProps) {
  const handleOpenChange = (details: { open?: boolean }) => {
    if (typeof details?.open !== "boolean") return;
    props.onOpenChange?.(details.open);
    if (details.open === false) props.onClose?.();
  };

  const shouldShowClose = () => props.showClose !== false;

  const contentClass = () => {
    const classes: string[] = [];
    const maxW = props.maxW ?? "720px";
    classes.push(
      css({
        maxW,
        "--dialog-base-margin": "24px",
        maxH: "calc(100vh - (var(--dialog-base-margin) * 2))",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }),
    );
    if (props.phoneSheet) classes.push(phoneSheetClass);
    if (props.contentClass) classes.push(props.contentClass);
    return classes.join(" ");
  };

  const hasHeader = () =>
    props.header !== undefined || !!props.title || !!props.description;

  const headerContent = () =>
    props.header ?? (
      <>
        <Show when={props.title}>
          {(title) => <Dialog.Title>{title()}</Dialog.Title>}
        </Show>
        <Show when={props.description}>
          {(description) => (
            <Dialog.Description>{description()}</Dialog.Description>
          )}
        </Show>
      </>
    );

  return (
    <Dialog.Root
      open={props.open}
      onOpenChange={handleOpenChange}
      initialFocusEl={props.initialFocusEl}
      restoreFocus={props.restoreFocus}
      closeOnInteractOutside={props.closeOnInteractOutside}
      onEscapeKeyDown={props.onEscapeKeyDown}
    >
      <WrapWhen when={props.skipPortal !== true} component={Portal}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content class={contentClass()}>
            <Show when={hasHeader()}>
              <Dialog.Header>{headerContent()}</Dialog.Header>
            </Show>
            <Show when={shouldShowClose()}>
              <Dialog.CloseTrigger
                aria-label={props.closeLabel ?? "Close dialog"}
                class={css({
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "8",
                  height: "8",
                  borderRadius: "sm",
                  color: "fg.muted",
                  _hover: { bg: "bg.muted" },
                })}
              >
                <XIcon size={16} />
              </Dialog.CloseTrigger>
            </Show>
            <Dialog.Body
              class={css({
                flex: "1",
                minH: "0",
                overflowY: "auto",
              })}
            >
              {props.children}
            </Dialog.Body>
            <Show when={props.footer}>
              {(footer) => <Dialog.Footer>{footer()}</Dialog.Footer>}
            </Show>
          </Dialog.Content>
        </Dialog.Positioner>
      </WrapWhen>
    </Dialog.Root>
  );
}
