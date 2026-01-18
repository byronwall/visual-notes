import { createEffect, createSignal, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { Box, HStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import * as Popover from "~/components/ui/popover";

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

  return (
    <Popover.Root
      open={props.open}
      onOpenChange={(details) => {
        props.onOpenChange(details.open);
        if (!details.open) props.onCancel();
      }}
      positioning={{ placement: "top-start", offset: 8 }}
    >
      <Popover.Trigger>{props.trigger}</Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content>
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
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};
