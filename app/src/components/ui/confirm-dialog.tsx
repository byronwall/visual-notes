import { type JSX } from "solid-js";
import { HStack, VStack } from "styled-system/jsx";
import { css } from "styled-system/css";
import { XIcon } from "lucide-solid";

import * as Dialog from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  children?: JSX.Element;
};

export function ConfirmDialog(props: ConfirmDialogProps) {
  const confirmLabel = () => props.confirmLabel ?? "Confirm";
  const cancelLabel = () => props.cancelLabel ?? "Cancel";

  const handleConfirm = () => {
    console.log("ConfirmDialog:handleConfirm");
    props.onConfirm();
    props.onOpenChange(false);
  };

  const handleCancel = () => {
    console.log("ConfirmDialog:handleCancel");
    props.onOpenChange(false);
  };

  const handleOpenChange = (details: { open?: boolean }) => {
    if (typeof details?.open === "boolean") {
      props.onOpenChange(details.open);
    }
  };

  return (
    <Dialog.Root open={props.open} onOpenChange={handleOpenChange}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content
          class={css({
            maxW: "480px",
            "--dialog-base-margin": "24px",
          })}
        >
          <Dialog.Header>
            <Dialog.Title>{props.title}</Dialog.Title>
            <Dialog.Description>{props.description}</Dialog.Description>
          </Dialog.Header>

          <Dialog.CloseTrigger aria-label="Close dialog" onClick={handleCancel}>
            <XIcon />
          </Dialog.CloseTrigger>

          <Dialog.Body>
            <VStack gap="4" alignItems="stretch">
              {props.children}
            </VStack>
          </Dialog.Body>

          <Dialog.Footer>
            <HStack justify="flex-end" gap="2" w="full">
              <Button variant="outline" onClick={handleCancel}>
                {cancelLabel()}
              </Button>
              <Button variant="solid" onClick={handleConfirm}>
                {confirmLabel()}
              </Button>
            </HStack>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
