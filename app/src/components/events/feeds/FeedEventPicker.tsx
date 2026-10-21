import { For, Show, createResource, createSignal, onCleanup } from "solid-js";
import { Box, HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import type { FeedEntryMode } from "~/lib/events/types";
import { fetchEventList } from "~/services/events/events.queries";

/** Search events by note title and include or exclude one. */
export function FeedEventPicker(props: {
  existing: Set<string>;
  onPick: (eventId: string, mode: FeedEntryMode) => void;
}) {
  const [text, setText] = createSignal("");
  const [search, setSearch] = createSignal("");
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));
  const onInput = (value: string) => {
    setText(value);
    clearTimeout(timer);
    timer = setTimeout(() => setSearch(value.trim()), 200);
  };
  const [results] = createResource(
    () => search() || false,
    (q) => fetchEventList({ search: q, limit: 8 }),
  );
  const visible = () =>
    search()
      ? (results.latest ?? []).filter((e) => !props.existing.has(e.id))
      : [];

  const pick = (eventId: string, mode: FeedEntryMode) => {
    props.onPick(eventId, mode);
    setText("");
    setSearch("");
  };

  return (
    <Stack gap="1.5">
      <Input
        size="sm"
        placeholder="Add an event by title…"
        aria-label="Search events to add"
        value={text()}
        onInput={(e) => onInput(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onInput("");
        }}
      />
      <Show when={search()}>
        <Box
          borderWidth="1px"
          borderColor="border"
          borderRadius="l2"
          overflow="hidden"
        >
          <Show
            when={visible().length > 0}
            fallback={
              <Text fontSize="sm" color="fg.muted" px="3" py="2">
                {results.loading && !results.latest
                  ? "Searching…"
                  : "No matching events."}
              </Text>
            }
          >
            <For each={visible()}>
              {(event) => (
                <HStack
                  gap="2"
                  px="3"
                  py="1.5"
                  borderBottomWidth="1px"
                  borderColor="border.subtle"
                  _last={{ borderBottomWidth: "0" }}
                >
                  <Text fontSize="sm" flex="1" minW="0" truncate>
                    {event.title}
                  </Text>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => pick(event.id, "include")}
                  >
                    Include
                  </Button>
                  <Button
                    size="xs"
                    variant="plain"
                    onClick={() => pick(event.id, "exclude")}
                  >
                    Exclude
                  </Button>
                </HStack>
              )}
            </For>
          </Show>
        </Box>
      </Show>
    </Stack>
  );
}
