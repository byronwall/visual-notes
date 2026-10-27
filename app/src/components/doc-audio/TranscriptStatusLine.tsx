import { type JSX, Show } from "solid-js";
import { HStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { Text } from "~/components/ui/text";

/**
 * One line under a recording that has no transcript yet: what is happening
 * on the left, the one action that moves it forward on the right.
 */
export const TranscriptStatusLine = (props: {
  children: JSX.Element;
  tone?: "muted" | "error";
  busy?: boolean;
  action?: string;
  onAction?: () => void;
}) => (
  <HStack gap="2" justifyContent="space-between" alignItems="flex-start">
    <HStack gap="1.5" minW="0" alignItems="flex-start">
      <Show when={props.busy}>
        <Spinner size="xs" color="fg.muted" mt="0.5" flexShrink="0" />
      </Show>
      <Text
        fontSize="xs"
        lineHeight="1.5"
        color={props.tone === "error" ? "red.11" : "fg.muted"}
        lineClamp="2"
        role={props.tone === "error" ? "alert" : "status"}
      >
        {props.children}
      </Text>
    </HStack>
    <Show when={props.action}>
      <Button
        size="2xs"
        variant="outline"
        flexShrink="0"
        onClick={() => props.onAction?.()}
      >
        {props.action}
      </Button>
    </Show>
  </HStack>
);
