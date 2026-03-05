import type { Accessor } from "solid-js";
import { createSignal, Show } from "solid-js";
import { Box, Flex, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";

type GlobalErrorOverlayProps = {
  title: string;
  message: string;
  error?: unknown;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  open?: Accessor<boolean>;
};

const getErrorMessage = (error: unknown) => {
  if (!error) return "";
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
};

const getErrorStack = (error: unknown) => {
  if (error instanceof Error && error.stack) return error.stack;
  return "";
};

const safeSerialize = (value: unknown) => {
  const seen = new WeakSet<object>();
  try {
    return JSON.parse(
      JSON.stringify(value, (_key, currentValue: unknown) => {
        if (typeof currentValue === "bigint") return currentValue.toString();
        if (typeof currentValue !== "object" || currentValue === null) return currentValue;
        if (seen.has(currentValue)) return "[Circular]";
        seen.add(currentValue);
        return currentValue;
      }),
    );
  } catch {
    return String(value);
  }
};

export function GlobalErrorOverlay(props: GlobalErrorOverlayProps) {
  const [copyStatus, setCopyStatus] = createSignal<"idle" | "success" | "error">("idle");
  const isOpen = () => props.open?.() ?? true;
  const detailsMessage = () => getErrorMessage(props.error);
  const detailsStack = () => getErrorStack(props.error);
  const hasCopyData = () => Boolean(props.error || detailsMessage() || detailsStack());

  const copyErrorJson = async () => {
    const payload = {
      title: props.title,
      message: props.message,
      error: safeSerialize(props.error),
      errorMessage: detailsMessage(),
      stack: detailsStack(),
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopyStatus("success");
    } catch {
      setCopyStatus("error");
    }
  };

  return (
    <Show when={isOpen()}>
      <Box position="fixed" inset="0" zIndex="tooltip" bg="bg.canvas/80">
        <Flex h="full" w="full" align="center" justify="center" p="4">
          <Box
            w="full"
            maxW="40rem"
            bg="bg.default"
            borderWidth="1px"
            borderColor="border"
            borderRadius="l3"
            boxShadow="lg"
            p="5"
          >
            <Stack gap="4">
              <Stack gap="2">
                <Text fontSize="lg" fontWeight="semibold">
                  {props.title}
                </Text>
                <Text fontSize="sm" color="fg.muted">
                  {props.message}
                </Text>
              </Stack>

              <Show when={detailsMessage()}>
                <Stack gap="2">
                  <Text fontSize="xs" color="fg.subtle" textTransform="uppercase" letterSpacing="wide">
                    Error details
                  </Text>
                  <Box
                    as="pre"
                    p="3"
                    bg="bg.subtle"
                    borderWidth="1px"
                    borderColor="border"
                    borderRadius="l2"
                    fontSize="xs"
                    whiteSpace="pre-wrap"
                    wordBreak="break-word"
                    maxH="10rem"
                    overflowY="auto"
                  >
                    {detailsMessage()}
                  </Box>
                </Stack>
              </Show>

              <Show when={detailsStack()}>
                <details>
                  <summary>
                    <Text as="span" fontSize="sm" color="fg.muted">
                      Show stack trace
                    </Text>
                  </summary>
                  <Box
                    as="pre"
                    mt="2"
                    p="3"
                    bg="bg.subtle"
                    borderWidth="1px"
                    borderColor="border"
                    borderRadius="l2"
                    fontSize="xs"
                    whiteSpace="pre-wrap"
                    wordBreak="break-word"
                    maxH="12rem"
                    overflowY="auto"
                  >
                    {detailsStack()}
                  </Box>
                </details>
              </Show>

              <Flex justify="flex-end" gap="2">
                <Show when={hasCopyData()}>
                  <Button variant="plain" onClick={() => void copyErrorJson()}>
                    Copy JSON
                  </Button>
                </Show>
                <Show when={props.onSecondaryAction && props.secondaryActionLabel}>
                  <Button variant="outline" onClick={() => props.onSecondaryAction?.()}>
                    {props.secondaryActionLabel}
                  </Button>
                </Show>
                <Show when={props.onPrimaryAction && props.primaryActionLabel}>
                  <Button variant="solid" colorPalette="blue" onClick={() => props.onPrimaryAction?.()}>
                    {props.primaryActionLabel}
                  </Button>
                </Show>
              </Flex>

              <Show when={copyStatus() === "success"}>
                <Text fontSize="xs" color="fg.success">
                  Copied error details as JSON.
                </Text>
              </Show>
              <Show when={copyStatus() === "error"}>
                <Text fontSize="xs" color="fg.danger">
                  Unable to copy error details.
                </Text>
              </Show>
            </Stack>
          </Box>
        </Flex>
      </Box>
    </Show>
  );
}
