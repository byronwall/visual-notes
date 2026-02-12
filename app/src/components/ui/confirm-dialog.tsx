import { type JSX } from "solid-js";
import { HStack, VStack } from "styled-system/jsx";
import { SimpleDialog } from "~/components/ui/simple-dialog";
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
    props.onConfirm();
    props.onOpenChange(false);
  };

  const handleCancel = () => {
    props.onOpenChange(false);
  };

  return (
    <SimpleDialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      onClose={handleCancel}
      title={props.title}
      description={props.description}
      maxW="480px"
      footer={
        <HStack justify="flex-end" gap="2" w="full">
          <Button variant="outline" onClick={handleCancel}>
            {cancelLabel()}
          </Button>
          <Button variant="solid" onClick={handleConfirm}>
            {confirmLabel()}
          </Button>
        </HStack>
      }
    >
      <VStack gap="4" alignItems="stretch">
        {props.children}
      </VStack>
    </SimpleDialog>
  );
}
