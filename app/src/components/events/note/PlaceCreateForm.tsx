import { Show, createSignal, type VoidComponent } from "solid-js";
import { Grid, HStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import type { PlaceSummary } from "~/lib/events/types";
import { useNoteEvent } from "./NoteEventContext";

const parseCoord = (value: string, limit: number) => {
  if (!value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : undefined;
};

/** Inline new-place form: name, street, city, and optional coordinates. */
export const PlaceCreateForm: VoidComponent<{
  initialName?: string;
  onCreated: (place: PlaceSummary) => void;
  onCancel: () => void;
}> = (props) => {
  const { createPlace } = useNoteEvent();
  const [name, setName] = createSignal(props.initialName?.trim() ?? "");
  const [street, setStreet] = createSignal("");
  const [city, setCity] = createSignal("Indianapolis");
  const [lat, setLat] = createSignal("");
  const [lng, setLng] = createSignal("");
  const [error, setError] = createSignal("");
  const [busy, setBusy] = createSignal(false);

  // Not a <form>: this can render inside the show editor's own form.
  const submit = async () => {
    const latitude = parseCoord(lat(), 90);
    const longitude = parseCoord(lng(), 180);
    if (!name().trim()) return setError("Name the place");
    if (latitude === undefined || longitude === undefined) {
      return setError("Coordinates must be numbers");
    }
    setError("");
    setBusy(true);
    const place = await createPlace({
      name: name().trim(),
      street: street().trim() || null,
      city: city().trim() || null,
      latitude,
      longitude,
    });
    setBusy(false);
    if (place) props.onCreated(place);
  };

  const field = (
    label: string,
    value: () => string,
    set: (v: string) => void,
    extra: Record<string, unknown> = {},
  ) => (
    <Input
      size="xs"
      placeholder={label}
      aria-label={label}
      value={value()}
      onInput={(e) => set(e.currentTarget.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          void submit();
        }
      }}
      {...extra}
    />
  );

  return (
    <Grid gap="1.5" aria-label="New place">
      {field("Place name", name, setName, {
        ref: (el: HTMLInputElement) => queueMicrotask(() => el.focus()),
      })}
      {field("Street", street, setStreet)}
      {field("City", city, setCity)}
      <Grid gridTemplateColumns="1fr 1fr" gap="1.5">
        {field("Latitude (optional)", lat, setLat, { inputMode: "decimal" })}
        {field("Longitude (optional)", lng, setLng, { inputMode: "decimal" })}
      </Grid>
      <Show when={error()}>
        <Text textStyle="xs" color="red.fg">
          {error()}
        </Text>
      </Show>
      <HStack gap="1.5" justify="flex-end">
        <Button
          size="xs"
          variant="plain"
          colorPalette="gray"
          onClick={props.onCancel}
        >
          Cancel
        </Button>
        <Button size="xs" loading={busy()} onClick={() => void submit()}>
          Create place
        </Button>
      </HStack>
    </Grid>
  );
};
