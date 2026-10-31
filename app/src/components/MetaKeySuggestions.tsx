import { For, Show, createMemo } from "solid-js";
import { createKeptAsync } from "~/utils/kept-async";
import type { VoidComponent } from "solid-js";
import { fetchMetaKeys } from "~/services/docs.service";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { HStack, Stack } from "styled-system/jsx";

export const MetaKeySuggestions: VoidComponent<{
  onSelect: (key: string) => void;
  limit?: number;
}> = (props) => {
  const keySuggestions = createKeptAsync(() => fetchMetaKeys());
  const topKeys = createMemo(() =>
    (Array.isArray(keySuggestions())
      ? (keySuggestions() as { key: string; count: number }[])
      : []
    ).slice(0, props.limit ?? 10)
  );

  return (
    <Stack mt="0.5rem">
      <Show when={topKeys().length > 0}>
        <HStack gap="0.5rem" flexWrap="wrap" justifyContent="flex-start">
          <For each={topKeys()}>
            {(s) => (
              <Button
                size="xs"
                variant="outline"
                onClick={() => props.onSelect(s.key)}
                title={`${s.key} (${s.count})`}
                tabindex="-1"
              >
                <Text
                  as="span"
                  fontWeight="semibold"
                  maxW="10rem"
                  overflow="hidden"
                  textOverflow="ellipsis"
                  whiteSpace="nowrap"
                >
                  {s.key}
                </Text>
                <Text as="span" color="fg.muted">
                  {s.count}
                </Text>
              </Button>
            )}
          </For>
        </HStack>
      </Show>
    </Stack>
  );
};
