import { MapPinIcon, PlusIcon, XIcon } from "lucide-solid";
import {
  For,
  Show,
  createResource,
  createSignal,
  onCleanup,
  type VoidComponent,
} from "solid-js";
import { css } from "styled-system/css";
import { Box, HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import type { PlaceSummary } from "~/lib/events/types";
import { fetchPlaces } from "~/services/events/events.queries";
import { PlaceCreateForm } from "./PlaceCreateForm";

const optionClass = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  w: "full",
  px: "2",
  py: "1",
  borderRadius: "l1",
  textAlign: "left",
  cursor: "pointer",
  _hover: { bg: "gray.a3" },
  _focusVisible: { outline: "2px solid", outlineColor: "border.focus" },
});

/**
 * Inline place picker: search existing places or create one. Inline rather
 * than a popover so it also works inside the show editor dialog.
 */
export const PlacePicker: VoidComponent<{
  place: PlaceSummary | null;
  onChange: (place: PlaceSummary | null) => void;
  /** Text when no place is set, e.g. "Same as event". */
  emptyLabel?: string;
}> = (props) => {
  const [open, setOpen] = createSignal(false);
  const [creating, setCreating] = createSignal(false);
  const [search, setSearch] = createSignal("");
  const [query, setQuery] = createSignal("");
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));

  const [places] = createResource(
    () => (open() ? { search: query() } : false),
    (input) => fetchPlaces(input.search ? { search: input.search } : {}),
  );

  const onSearch = (value: string) => {
    setSearch(value);
    clearTimeout(timer);
    timer = setTimeout(() => setQuery(value.trim()), 200);
  };

  const pick = (place: PlaceSummary | null) => {
    props.onChange(place);
    setOpen(false);
    setCreating(false);
  };

  return (
    <Stack gap="1.5" minW="0">
      <HStack gap="1" minW="0">
        <Button
          size="xs"
          variant="outline"
          colorPalette="gray"
          justifyContent="flex-start"
          flex="1"
          minW="0"
          fontWeight="normal"
          aria-expanded={open()}
          onClick={() => setOpen(!open())}
        >
          <MapPinIcon size={13} />
          <Text
            as="span"
            truncate
            color={props.place ? "fg.default" : "fg.muted"}
            flexShrink="0"
            maxW="70%"
          >
            {props.place?.name ?? props.emptyLabel ?? "No place"}
          </Text>
          <Show when={props.place?.address}>
            <Text as="span" truncate color="fg.subtle" textStyle="xs">
              {props.place!.address}
            </Text>
          </Show>
        </Button>
        <Show when={props.place}>
          <Button
            size="xs"
            variant="plain"
            colorPalette="gray"
            px="1"
            aria-label="Clear place"
            onClick={() => pick(null)}
          >
            <XIcon size={13} />
          </Button>
        </Show>
      </HStack>
      <Show when={open()}>
        <Box borderWidth="1px" borderColor="border" borderRadius="l2" p="1.5">
          <Show
            when={!creating()}
            fallback={
              <PlaceCreateForm
                initialName={search()}
                onCreated={pick}
                onCancel={() => setCreating(false)}
              />
            }
          >
            <Input
              size="xs"
              placeholder="Search places"
              aria-label="Search places"
              value={search()}
              onInput={(e) => onSearch(e.currentTarget.value)}
              ref={(el) => queueMicrotask(() => el.focus())}
            />
            <Stack gap="0" mt="1" maxH="48" overflowY="auto">
              <For each={places.latest ?? []}>
                {(place) => (
                  <button
                    type="button"
                    class={optionClass}
                    onClick={() => pick(place)}
                  >
                    <Text textStyle="sm">{place.name}</Text>
                    <Show when={place.address}>
                      <Text textStyle="xs" color="fg.muted">
                        {place.address}
                      </Text>
                    </Show>
                  </button>
                )}
              </For>
              <Show when={places.latest?.length === 0}>
                <Text textStyle="xs" color="fg.muted" px="2" py="1">
                  No matching places.
                </Text>
              </Show>
            </Stack>
            <Button
              size="xs"
              variant="plain"
              colorPalette="gray"
              mt="1"
              px="2"
              onClick={() => setCreating(true)}
            >
              <PlusIcon size={13} />
              New place{search().trim() ? ` “${search().trim()}”` : ""}
            </Button>
          </Show>
        </Box>
      </Show>
    </Stack>
  );
};
