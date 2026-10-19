import { type JSX, Show } from "solid-js";
import { HStack } from "styled-system/jsx";
import { Heading } from "~/components/ui/heading";
import { Text } from "~/components/ui/text";

type SecondaryPageHeaderProps = {
  title: JSX.Element;
  /** Plain-text summary shown next to the title (counts, status). */
  summary?: JSX.Element;
  /** Primary actions, aligned to the right on the same row. */
  actions?: JSX.Element;
};

/**
 * One compact row for title + summary + actions, shared by the secondary
 * pages so they read as one product. Show callbacks keep JSX props from
 * being created twice, which breaks hydration.
 */
export const SecondaryPageHeader = (props: SecondaryPageHeaderProps) => (
  <HStack justify="space-between" alignItems="center" gap="3" flexWrap="wrap" minH="9">
    <HStack gap="3" alignItems="baseline" flexWrap="wrap" minW="0">
      <Heading as="h1" fontSize="2xl" lineHeight="1.2">
        {props.title}
      </Heading>
      <Show when={props.summary}>
        {(summary) => (
          <Text fontSize="sm" color="fg.muted">
            {summary()}
          </Text>
        )}
      </Show>
    </HStack>
    <Show when={props.actions}>
      {(actions) => (
        <HStack gap="2" flexWrap="wrap" alignItems="center">
          {actions()}
        </HStack>
      )}
    </Show>
  </HStack>
);
