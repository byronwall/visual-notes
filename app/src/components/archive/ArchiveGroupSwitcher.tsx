import { ChevronDownIcon } from "lucide-solid";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { Box, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import * as Popover from "~/components/ui/popover";

export const ArchiveGroupSwitcher = (props: {
  value: string;
  options: string[];
  placeholder?: string;
  onCommit: (value: string) => void | Promise<void>;
}) => {
  const [open, setOpen] = createSignal(false);
  const [draft, setDraft] = createSignal(props.value);

  createEffect(() => {
    if (open()) return;
    setDraft(props.value);
  });

  const filteredOptions = createMemo(() => {
    const query = draft().trim().toLowerCase();
    return props.options.filter((option) => {
      if (!query) return true;
      return option.toLowerCase().includes(query);
    });
  });

  const createOption = createMemo(() => {
    const next = draft().trim();
    if (!next) return null;
    const exists = props.options.some((option) => option.toLowerCase() === next.toLowerCase());
    return exists ? null : next;
  });

  const commit = async (value: string) => {
    await props.onCommit(value.trim());
    setOpen(false);
  };

  return (
    <Box minW="0" maxW="full" flexShrink="0" onClick={(event) => event.stopPropagation()}>
      <Popover.Root
        open={open()}
        onOpenChange={(details) => setOpen(details.open)}
        positioning={{ placement: "bottom-start", gutter: 4 }}
      >
        <Popover.Trigger
          type="button"
          aria-label={props.value ? `Change group (${props.value})` : "Assign group"}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          display="inline-flex"
          alignItems="center"
          gap="1"
          maxW="full"
          minW="0"
          h="7"
          px="2"
          ml="-2"
          borderRadius="l2"
          fontSize="sm"
          color={props.value ? "fg.default" : "fg.subtle"}
          cursor="pointer"
          transitionProperty="background-color, color"
          transitionDuration="fast"
          _hover={{ bg: "bg.hover", color: "fg.default" }}
          _expanded={{ bg: "bg.active", color: "fg.default" }}
          class="group"
        >
          <Box as="span" minW="0" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
            {props.value || props.placeholder || "No group"}
          </Box>
          <Box
            as="span"
            display="inline-flex"
            flexShrink="0"
            color="fg.subtle"
            opacity={props.value ? 0 : 1}
            transitionProperty="opacity"
            transitionDuration="fast"
            _groupHover={{ opacity: 1 }}
            _groupExpanded={{ opacity: 1 }}
          >
            <ChevronDownIcon size={13} />
          </Box>
        </Popover.Trigger>
        <Portal>
          <Popover.Positioner>
            <Popover.Content
              minW="14rem"
              maxW="calc(100vw - 2rem)"
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <Stack gap="2" p="2">
                <Input
                  size="sm"
                  autofocus
                  value={draft()}
                  placeholder="Find or create group"
                  onInput={(event) => setDraft(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      const next = createOption() || draft().trim();
                      if (next) void commit(next);
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      setOpen(false);
                    }
                  }}
                />

                <Stack gap="1" maxH="14rem" overflowY="auto">
                  <Show when={createOption()}>
                    {(newOption) => (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        justifyContent="flex-start"
                        onClick={() => void commit(newOption())}
                      >
                        Create “{newOption()}”
                      </Button>
                    )}
                  </Show>

                  <Show when={props.value}>
                    <Button
                      type="button"
                      variant="plain"
                      size="sm"
                      justifyContent="flex-start"
                      onClick={() => void commit("")}
                    >
                      Remove group
                    </Button>
                  </Show>

                  <For each={filteredOptions()}>
                    {(option) => (
                      <Button
                        type="button"
                        variant={option === props.value ? "subtle" : "plain"}
                        size="sm"
                        justifyContent="flex-start"
                        onClick={() => void commit(option)}
                      >
                        {option}
                      </Button>
                    )}
                  </For>

                  <Show when={filteredOptions().length === 0 && !createOption()}>
                    <Box px="2" py="1.5">
                      <Text fontSize="xs" color="fg.muted">
                        No matching groups
                      </Text>
                    </Box>
                  </Show>
                </Stack>
              </Stack>
            </Popover.Content>
          </Popover.Positioner>
        </Portal>
      </Popover.Root>
    </Box>
  );
};
