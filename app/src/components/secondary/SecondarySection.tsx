import { type JSX, Show } from "solid-js";
import { Box, HStack } from "styled-system/jsx";
import { Heading } from "~/components/ui/heading";
import { Text } from "~/components/ui/text";

type SectionProps = {
  title: string;
  meta?: JSX.Element;
  actions?: JSX.Element;
  children: JSX.Element;
};

/** Section with a small heading row; content sits on the page, not in a card. */
export const SecondarySection = (props: SectionProps) => (
  <Box>
    <HStack justify="space-between" alignItems="center" gap="3" px="3" pb="1.5" minH="8">
      <HStack gap="2" alignItems="baseline">
        <Heading as="h2" fontSize="md" fontWeight="semibold">
          {props.title}
        </Heading>
        <Show when={props.meta}>
          {(meta) => (
            <Text fontSize="xs" color="fg.subtle">
              {meta()}
            </Text>
          )}
        </Show>
      </HStack>
      {/* Callback children so JSX props are created once (hydration-safe). */}
      <Show when={props.actions}>{(actions) => <HStack gap="2">{actions()}</HStack>}</Show>
    </HStack>
    {props.children}
  </Box>
);
