import { Show, type JSX } from "solid-js";
import { HStack, Stack } from "styled-system/jsx";
import { Text } from "~/components/ui/text";

/** Labeled block inside a feed card. */
export function FeedSection(props: {
  title: string;
  hint?: string;
  aside?: JSX.Element;
  children: JSX.Element;
}) {
  return (
    <Stack gap="2" minW="0">
      <HStack justify="space-between" gap="2" minH="6">
        <Text
          as="h3"
          fontSize="xs"
          fontWeight="semibold"
          color="fg.muted"
          textTransform="uppercase"
          letterSpacing="wide"
        >
          {props.title}
        </Text>
        {props.aside}
      </HStack>
      <Show when={props.hint}>
        <Text fontSize="xs" color="fg.subtle" mt="-1">
          {props.hint}
        </Text>
      </Show>
      {props.children}
    </Stack>
  );
}
