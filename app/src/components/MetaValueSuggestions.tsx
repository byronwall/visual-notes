import { For, Show, createMemo } from "solid-js";
import { createAsync } from "@solidjs/router";
import type { VoidComponent } from "solid-js";
import { fetchMetaValues } from "~/services/docs.service";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { HStack, Stack } from "styled-system/jsx";

export const MetaValueSuggestions: VoidComponent<{
  keyName: string;
  onSelect: (value: string) => void;
  limit?: number;
}> = (props) => {
  const valueSuggestions = createAsync(() => {
    if (!props.keyName.trim()) return Promise.resolve([]);
    return fetchMetaValues(props.keyName);
  });
  const topValues = createMemo(() =>
    (Array.isArray(valueSuggestions())
      ? (valueSuggestions() as { value: string; count: number }[])
      : []
    ).slice(0, props.limit ?? 10)
  );

  return (
    <Show when={props.keyName.trim().length > 0 && topValues().length > 0}>
      <Stack mt="0.5rem">
        <HStack gap="0.5rem" flexWrap="wrap" justifyContent="flex-start">
          <For each={topValues()}>
            {(s) => (
              <Button
                size="xs"
                variant="outline"
                onClick={() => props.onSelect(s.value)}
                title={`${s.value} (${s.count})`}
              >
                <Text
                  as="span"
                  fontWeight="semibold"
                  maxW="12rem"
                  overflow="hidden"
                  textOverflow="ellipsis"
                  whiteSpace="nowrap"
                >
                  {s.value}
                </Text>
                <Text as="span" color="fg.muted">
                  {s.count}
                </Text>
              </Button>
            )}
          </For>
        </HStack>
      </Stack>
    </Show>
  );
};
