import {
  createEffect,
  createSignal,
  onCleanup,
  onMount,
  type VoidComponent,
} from "solid-js";
import { Box, HStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

type TitleEditPopoverProps = {
  initialTitle: string;
  onConfirm: (title: string) => void;
  onCancel: () => void;
};

export const TitleEditPopover: VoidComponent<TitleEditPopoverProps> = (
  props
) => {
  const [value, setValue] = createSignal(props.initialTitle || "");
  let inputRef: HTMLInputElement | undefined;

  createEffect(() => {
    setValue(props.initialTitle || "");
  });

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      try {
        console.log("[TitleEditPopover] ESC pressed → cancel");
      } catch {}
      props.onCancel();
    } else if (e.key === "Enter") {
      const v = value().trim();
      if (v.length === 0) return;
      try {
        console.log("[TitleEditPopover] ENTER pressed → confirm", v);
      } catch {}
      props.onConfirm(v);
    }
  };

  onMount(() => {
    if (inputRef) {
      inputRef.focus();
      try {
        inputRef.select();
      } catch {}
    }
    window.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    window.removeEventListener("keydown", handleKeyDown);
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
  };

  return (
    <Box
      position="absolute"
      left="0"
      zIndex="20"
      borderRadius="l2"
      borderWidth="1px"
      borderColor="border"
      bg="bg.default"
      boxShadow="lg"
      p="2"
      style={{
        top: "-0.75rem",
        transform: "translateY(-100%)",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <HStack gap="2">
        <Input
          ref={(el) => (inputRef = el)}
          type="text"
          value={value()}
          onInput={handleChange}
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
  );
};
