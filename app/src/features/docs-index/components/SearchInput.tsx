import type { VoidComponent } from "solid-js";
import { Show } from "solid-js";
import { ClearButton } from "~/components/ui/clear-button";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import { HStack, Stack } from "styled-system/jsx";

export const SearchInput: VoidComponent<{
  value: string;
  onChange: (v: string) => void;
}> = (props) => {
  const handleChange = (e: Event) => {
    const target = e.currentTarget as HTMLInputElement;
    props.onChange(target.value);
  };
  return (
    <Stack gap="1">
      <HStack justify="space-between" alignItems="center">
        <Text fontSize="xs" color="black.a7" fontWeight="medium">
          Search
        </Text>
        <HStack gap="2" alignItems="center">
          <Text fontSize="xs" color="black.a7">
            Title, path, and note content
          </Text>
          <Show when={props.value.trim().length > 0}>
            <ClearButton label="Clear search" onClick={() => props.onChange("")} />
          </Show>
        </HStack>
      </HStack>
      <Input
        size="sm"
        w="full"
        minW="0"
        placeholder="Search notes..."
        value={props.value}
        onInput={handleChange}
        autocomplete="off"
        autocapitalize="none"
        autocorrect="off"
        spellcheck={false}
      />
    </Stack>
  );
};
