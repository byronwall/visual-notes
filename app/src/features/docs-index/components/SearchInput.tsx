import type { VoidComponent } from "solid-js";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import { HStack } from "styled-system/jsx";

export const SearchInput: VoidComponent<{
  value: string;
  onChange: (v: string) => void;
}> = (props) => {
  const handleChange = (e: Event) => {
    const target = e.currentTarget as HTMLInputElement;
    props.onChange(target.value);
  };
  return (
    <HStack gap="0.5rem" mt="0.75rem">
      <Text fontSize="xs" color="black.a7" width="6rem" flexShrink="0">
        Search
      </Text>
      <Input
        size="sm"
        flex="1"
        minW="0"
        placeholder="Filter by title (client) and contents (server)"
        value={props.value}
        onInput={handleChange}
        autocomplete="off"
        autocapitalize="none"
        autocorrect="off"
        spellcheck={false}
      />
    </HStack>
  );
};
