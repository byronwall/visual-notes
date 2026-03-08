import { createEffect } from "solid-js";
import { css } from "styled-system/css";
import { Box, HStack, Stack } from "styled-system/jsx";
import { Text } from "~/components/ui/text";

type Props = {
  depth: number;
  value: string;
  saving: boolean;
  error: string | null;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
};

const inlineInputClass = css({
  appearance: "none",
  bg: "transparent",
  borderWidth: "0",
  boxShadow: "none",
  color: "fg.default",
  flex: "1",
  fontSize: "sm",
  fontWeight: "medium",
  lineHeight: "1.3",
  minW: "0",
  outline: "none",
  p: "0",
  w: "full",
  _placeholder: {
    color: "fg.muted",
  },
});

export const TaskDraftRow = (props: Props) => {
  let inputRef: HTMLInputElement | undefined;
  let hasFocusedInput = false;

  createEffect(() => {
    if (!inputRef || hasFocusedInput) return;
    hasFocusedInput = true;
    queueMicrotask(() => {
      inputRef?.focus();
    });
  });

  return (
    <Stack gap="1">
      <HStack
        data-testid="task-inline-create-row"
        gap="2"
        borderWidth="1px"
        borderColor="blue.500"
        borderRadius="md"
        px="2"
        py="1"
        bg="blue.subtle"
        ml={props.depth > 0 ? "5" : "0"}
      >
        <Box w="6" />
        <Box w="4" />
        <Stack gap="0.5" flex="1" minW="0">
          <input
            ref={(node) => {
              inputRef = node;
            }}
            value={props.value}
            onInput={(event) => props.onChange(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                props.onSubmit();
                return;
              }
              if (event.key === "Escape") {
                event.preventDefault();
                props.onCancel();
              }
            }}
            disabled={props.saving}
            placeholder="New task title. Use #tags inline"
            class={inlineInputClass}
          />
          <Text fontSize="xs" color="fg.muted">
            Enter saves. Escape cancels. Include #tags in the title.
          </Text>
        </Stack>
      </HStack>

      {props.error ? (
        <Text fontSize="xs" color="red.fg" ml={props.depth > 0 ? "5" : "0"}>
          {props.error}
        </Text>
      ) : null}
    </Stack>
  );
};
