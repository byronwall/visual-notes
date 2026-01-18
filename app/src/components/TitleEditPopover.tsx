import { createEffect, createSignal, type JSX } from "solid-js";
import { Box, HStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { SimplePopover } from "~/components/ui/simple-popover";

type TitleEditPopoverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTitle: string;
  onConfirm: (title: string) => void;
  onCancel: () => void;
  trigger: JSX.Element;
};

export const TitleEditPopover = (props: TitleEditPopoverProps) => {
  const [value, setValue] = createSignal(props.initialTitle || "");
  let inputRef: HTMLInputElement | undefined;

  createEffect(() => {
    setValue(props.initialTitle || "");
  });

  createEffect(() => {
    if (!props.open) return;
    if (!inputRef) return;
    inputRef.focus();
    inputRef.select();
  });

  const handleChange = (e: Event) => {
    const t = e.target as HTMLInputElement;
    setValue(t.value);
  };

  const handleConfirmClick = () => {
    const v = value().trim();
    if (v.length === 0) return;
    props.onConfirm(v);
  };

  const handleCancelClick = () => {
    props.onCancel();
    props.onOpenChange(false);
  };

  const handleInputKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Enter") return;
    const v = value().trim();
    if (v.length === 0) return;
    props.onConfirm(v);
  };

  const handleTriggerClick = () => {
    if (props.open) {
      props.onCancel();
      props.onOpenChange(false);
      return;
    }
    props.onOpenChange(true);
  };

  return (
    <SimplePopover
      open={props.open}
      onClose={() => {
        props.onCancel();
        props.onOpenChange(false);
      }}
      placement="top-start"
      offset={8}
      anchor={
        <Box display="inline-flex" onClick={handleTriggerClick}>
          {props.trigger}
        </Box>
      }
    >
      <Box p="2">
        <HStack gap="2">
          <Input
            ref={(el) => (inputRef = el)}
            type="text"
            value={value()}
            onInput={handleChange}
            onKeyDown={(e) => handleInputKeyDown(e)}
            w="16rem"
            size="sm"
          />
          <Button size="sm" variant="solid" onClick={handleConfirmClick}>
            Save
          </Button>
          <Button size="sm" variant="outline" onClick={handleCancelClick}>
            Cancel
          </Button>
        </HStack>
      </Box>
    </SimplePopover>
  );
};
