import type { VoidComponent } from "solid-js";
import { Show } from "solid-js";
import { SearchIcon } from "lucide-solid";
import { ClearButton } from "~/components/ui/clear-button";
import { Input } from "~/components/ui/input";
import { Kbd } from "~/components/ui/kbd";
import { Spinner } from "~/components/ui/spinner";
import { Box } from "styled-system/jsx";

export const SearchInput: VoidComponent<{
  value: string;
  loading?: boolean;
  onChange: (v: string) => void;
  onKeyDown?: (e: KeyboardEvent) => void;
  ref?: (el: HTMLInputElement) => void;
}> = (props) => {
  return (
    <Box position="relative" flex="1" minW="0">
      <Box
        position="absolute"
        left="2.5"
        top="50%"
        transform="translateY(-50%)"
        zIndex="1"
        color="fg.subtle"
        display="flex"
        pointerEvents="none"
      >
        <SearchIcon size={15} />
      </Box>
      <Input
        ref={props.ref}
        type="search"
        size="sm"
        ps="8"
        pe={{ base: "9", md: "16" }}
        bg="bg.default"
        placeholder="Search notes"
        aria-label="Search notes"
        value={props.value}
        onInput={(e) => props.onChange(e.currentTarget.value)}
        onKeyDown={(e) => props.onKeyDown?.(e)}
        autocomplete="off"
        autocapitalize="none"
        autocorrect="off"
        spellcheck={false}
        css={{ "&::-webkit-search-cancel-button": { display: "none" } }}
      />
      {/* Fixed-width end slot so spinner/clear/kbd never shift the text. */}
      <Box
        position="absolute"
        right="1.5"
        top="50%"
        transform="translateY(-50%)"
        display="flex"
        alignItems="center"
        justifyContent="flex-end"
        gap="1"
        w={{ base: "8", md: "14" }}
      >
        <Show when={props.loading}>
          <Spinner size="xs" />
        </Show>
        <Show
          when={props.value.length > 0}
          fallback={
            <Kbd
              size="sm"
              color="fg.subtle"
              title="Press / to search"
              // Phones have no "/" key to press.
              display={{ base: "none", md: "inline-flex" }}
            >
              /
            </Kbd>
          }
        >
          <ClearButton
            label="Clear search"
            onClick={() => props.onChange("")}
          />
        </Show>
      </Box>
    </Box>
  );
};
