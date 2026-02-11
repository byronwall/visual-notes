import { Show, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { css } from "styled-system/css";
import * as Dialog from "~/components/ui/dialog";
import { WrapWhen } from "./WrapWhen";
import { CloseButton } from "./close-button";

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
};

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
      })
    );
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
    <Dialog.Root open={props.open} onOpenChange={handleOpenChange}>
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
              >
                <CloseButton />
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
