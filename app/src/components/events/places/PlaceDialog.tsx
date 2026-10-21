import { useAction } from "@solidjs/router";
import { Show, createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import { css } from "styled-system/css";
import { HStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import { SimpleSelect } from "~/components/ui/simple-select";
import {
  PLACE_KINDS,
  PLACE_KIND_LABELS,
  type Place,
  type PlaceKind,
} from "~/lib/events/types";
import { addPlace, savePlace } from "~/services/events/events.actions";
import { PlaceField } from "./PlaceField";
import { emptyPlaceForm, placeFormFrom, toPlaceInput } from "./placeForm";

const form = css({
  display: "grid",
  gridTemplateColumns: {
    base: "minmax(0, 1fr)",
    sm: "repeat(6, minmax(0, 1fr))",
  },
  gap: "3",
  overflowY: "auto",
  py: "1",
});
/** Column span from `--span` on wider screens; one column on phones. */
export const spanCell = css({ minW: "0", sm: { gridColumn: "var(--span)" } });
const error = css({ fontSize: "sm", color: "red.11" });
const kindLabel = css({ fontSize: "sm", fontWeight: "medium", mb: "1.5" });

const KIND_ITEMS = PLACE_KINDS.map((k) => ({
  label: PLACE_KIND_LABELS[k],
  value: k,
}));

/** Create (`place` null) or edit a place. */
export function PlaceDialog(props: {
  place: Place | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = createStore(
    props.place ? placeFormFrom(props.place) : emptyPlaceForm(),
  );
  const [message, setMessage] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const create = useAction(addPlace);
  const update = useAction(savePlace);

  const submit = async (e?: Event) => {
    e?.preventDefault();
    const parsed = toPlaceInput(values);
    if ("error" in parsed) return setMessage(parsed.error);
    setBusy(true);
    try {
      if (props.place)
        await update({ id: props.place.id, patch: parsed.input });
      else await create(parsed.input);
      props.onSaved();
      props.onClose();
    } catch (err) {
      console.warn("[events-places] save failed", err);
      setMessage("Could not save this place. Check the fields and try again.");
    } finally {
      setBusy(false);
    }
  };

  const field = (
    key: Exclude<keyof typeof values, "kind">,
    label: string,
    span: number,
    extra: { type?: string; placeholder?: string; multiline?: boolean } = {},
  ) => (
    <PlaceField
      id={`place-${key}`}
      label={label}
      span={span}
      value={values[key]}
      onInput={(v) => setValues(key, v)}
      {...extra}
    />
  );

  return (
    <SimpleDialog
      open
      onClose={props.onClose}
      title={props.place ? "Edit place" : "New place"}
      maxW="560px"
      phoneSheet
      closeOnInteractOutside={false}
      footer={
        <HStack justify="flex-end" gap="2" w="full">
          <Button variant="outline" onClick={props.onClose}>
            Cancel
          </Button>
          <Button variant="solid" loading={busy()} onClick={() => submit()}>
            {props.place ? "Save" : "Add place"}
          </Button>
        </HStack>
      }
    >
      <form class={form} onSubmit={submit} data-place-form>
        {field("name", "Name", 4)}
        <div class={spanCell} style={{ "--span": "span 2" }}>
          <div class={kindLabel}>Kind</div>
          <SimpleSelect
            items={KIND_ITEMS}
            value={values.kind}
            onChange={(v) => setValues("kind", (v || "venue") as PlaceKind)}
            size="sm"
            skipPortal={false}
          />
        </div>
        {field("street", "Street", 6)}
        {field("city", "City", 3)}
        {field("state", "State", 1)}
        {field("postalCode", "Postal code", 2)}
        {field("latitude", "Latitude", 3, { placeholder: "39.7684" })}
        {field("longitude", "Longitude", 3, { placeholder: "-86.1581" })}
        {field("url", "Website", 6, { type: "url", placeholder: "https://" })}
        {field("notes", "Notes", 6, { multiline: true })}
        <button type="submit" hidden />
        <Show when={message()}>
          <p class={error} style={{ "grid-column": "1 / -1" }}>
            {message()}
          </p>
        </Show>
      </form>
    </SimpleDialog>
  );
}
