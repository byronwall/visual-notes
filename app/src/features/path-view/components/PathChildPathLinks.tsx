import { For } from "solid-js";
import { HStack } from "styled-system/jsx";
import { PathPillLink } from "~/components/path/PathPillLink";
import { Text } from "~/components/ui/text";
import { pathToRoute } from "~/utils/path-links";

export const PathChildPathLinks = (props: {
  childPaths: { path: string; count: number }[];
}) => {
  return (
    <HStack gap="2" flexWrap="wrap" alignItems="center">
      <Text fontSize="sm" color="fg.muted">
        Child paths:
      </Text>
      <For each={props.childPaths.slice(0, 8)}>
        {(child) => (
          <PathPillLink href={pathToRoute(child.path)} variant="outline">
            {child.path} ({child.count})
          </PathPillLink>
        )}
      </For>
    </HStack>
  );
};
