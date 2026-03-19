import { ChevronDownIcon } from "lucide-solid";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { Box, HStack, Stack } from "styled-system/jsx";
import { A } from "@solidjs/router";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import * as Popover from "~/components/ui/popover";

export const ArchiveGroupSwitcher = (props: {
  value: string;
  options: string[];
  canvasHref?: string;
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
    <HStack gap="1.5" minW="0" onClick={(event) => event.stopPropagation()}>
      <Show
        when={props.value}
        fallback={
          <Text fontSize="sm" color="fg.muted" fontFamily="mono">
            {"<no group>"}
          </Text>
        }
      >
        {(groupName) => (
          <Box
            as={A}
            href={props.canvasHref || "#"}
            onClick={(event) => event.stopPropagation()}
            minW="0"
            maxW="12rem"
            overflow="hidden"
            textOverflow="ellipsis"
            whiteSpace="nowrap"
            textDecoration="underline"
            borderRadius="l1"
            px="1"
            py="0.5"
            color="fg.default"
            _hover={{ bg: "bg.subtle" }}
          >
            {groupName()}
          </Box>
        )}
      </Show>

      <Popover.Root
        open={open()}
        onOpenChange={(details) => setOpen(details.open)}
        positioning={{ placement: "bottom-start", gutter: 6 }}
      >
        <Popover.Trigger
          type="button"
          aria-label={props.value ? `Change group for ${props.value}` : "Assign group"}
          onClick={(event) => event.stopPropagation()}
          display="inline-flex"
          alignItems="center"
          justifyContent="center"
          w="6"
          h="6"
          borderRadius="l1"
          color="fg.muted"
          _hover={{ bg: "bg.subtle", color: "fg.default" }}
        >
          <ChevronDownIcon size={14} />
        </Popover.Trigger>
        <Portal>
          <Popover.Positioner>
            <Popover.Content
              style={{
                width: "min(20rem, calc(100vw - 2rem))",
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <Stack gap="3" p="3">
                <Stack gap="1">
                  <Text fontSize="sm" fontWeight="semibold">
                    {props.value ? "Change group" : "Assign group"}
                  </Text>
                  <Text fontSize="xs" color="fg.muted">
                    Choose an existing group or create a new label.
                  </Text>
                </Stack>

                <Input
                  value={draft()}
                  placeholder="Group name"
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
                      variant="ghost"
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
                        variant={option === props.value ? "subtle" : "ghost"}
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
    </HStack>
  );
};
