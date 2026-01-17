import { For, Show } from "solid-js";
import { getTopMetaEntries } from "../utils/meta";
import { Button } from "~/components/ui/button";
import { HStack } from "styled-system/jsx";

export const MetaChips = (props: {
  meta?: Record<string, unknown> | null;
  onClick?: (k: string, v: string) => void;
}) => {
  return (
    <Show when={props.meta}>
      <HStack gap="0.25rem" flexWrap="wrap">
        <For each={getTopMetaEntries(props.meta as any)}>
          {(entry) => (
            <Button
              type="button"
              size="xs"
              variant="subtle"
              onClick={() => props.onClick?.(entry[0], entry[1])}
              title={`Filter by ${entry[0]}=${entry[1]}`}
            >
              {entry[0]}: {entry[1]}
            </Button>
          )}
        </For>
      </HStack>
    </Show>
  );
};

