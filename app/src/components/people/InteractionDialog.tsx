import { useAction } from "@solidjs/router";
import { Show, createSignal, untrack } from "solid-js";
import { createStore } from "solid-js/store";
import { css } from "styled-system/css";
import { HStack } from "styled-system/jsx";
import { DateInput } from "~/components/DateInput";
import { Button } from "~/components/ui/button";
import * as Field from "~/components/ui/field";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import { SimpleSelect } from "~/components/ui/simple-select";
import { Textarea } from "~/components/ui/textarea";
import { todayLocal } from "~/lib/people/dates";
import {
  INTERACTION_KINDS,
  INTERACTION_KIND_LABELS,
  type InteractionKind,
  type InteractionView,
} from "~/lib/people/types";
import { updateInteractionAction } from "~/services/people/people.actions";
import { saveErrorText } from "./capture-state";
import { PersonPicker, type PickedPerson } from "./PersonPicker";

const form = css({
  display: "flex",
  flexDirection: "column",
  w: "full",
  gap: "3",
  py: "1",
});
const row = css({
  display: "grid",
  gap: "3",
  gridTemplateColumns: { base: "1fr", sm: "1fr 1fr" },
});
const error = css({ fontSize: "sm", color: "red.11" });

const KIND_ITEMS = INTERACTION_KINDS.map((k) => ({
  label: INTERACTION_KIND_LABELS[k],
  value: k,
}));

/** Correct one encounter's day, type, text, or participants. */
export function InteractionDialog(props: {
  interaction: InteractionView;
  onClose: () => void;
}) {
  const i = untrack(() => props.interaction);
  const [values, setValues] = createStore({
    occurredOn: i.occurredOn,
    kind: i.kind,
    summary: i.summary,
  });
  const [people, setPeople] = createSignal<PickedPerson[]>(i.participants);
  const [message, setMessage] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const save = useAction(updateInteractionAction);

  const submit = async (e?: Event) => {
    e?.preventDefault();
    if (!people().length) return setMessage("Keep at least one person.");
    if (!values.summary.trim()) return setMessage("Write what happened.");
    setBusy(true);
    try {
      await save({
        id: i.id,
        patch: {
          occurredOn: values.occurredOn,
          kind: values.kind,
          summary: values.summary,
          participants: people().map((p) => ({
            personId: p.id,
            countsAsContact: p.countsAsContact,
          })),
        },
      });
      props.onClose();
    } catch (err) {
      console.warn("[people] interaction save failed", err);
      setMessage(
        saveErrorText(err, "Could not save. Your changes are kept; try again."),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <SimpleDialog
      open
      onClose={props.onClose}
      title="Edit interaction"
      maxW="520px"
      phoneSheet
      closeOnInteractOutside={false}
      footer={
        <HStack justify="flex-end" gap="2" w="full">
          <Button variant="outline" onClick={props.onClose}>
            Cancel
          </Button>
          <Button variant="solid" loading={busy()} onClick={() => submit()}>
            Save
          </Button>
        </HStack>
      }
    >
      <form class={form} onSubmit={submit}>
        <Field.Root>
          <Field.Label for="edit-people">People</Field.Label>
          <PersonPicker
            id="edit-people"
            value={people()}
            onChange={setPeople}
            multiple
            onError={setMessage}
          />
        </Field.Root>
        <div class={row}>
          <Field.Root>
            <Field.Label for="edit-day">Day</Field.Label>
            <DateInput
              id="edit-day"
              size="sm"
              max={todayLocal()}
              value={values.occurredOn}
              onChange={(v) => setValues("occurredOn", v ?? "")}
            />
          </Field.Root>
          <Field.Root>
            <Field.Label>Type</Field.Label>
            <SimpleSelect
              items={KIND_ITEMS}
              value={values.kind}
              onChange={(v) =>
                setValues("kind", (v || "in_person") as InteractionKind)
              }
              size="sm"
              skipPortal={false}
            />
          </Field.Root>
        </div>
        <Field.Root>
          <Field.Label for="edit-summary">What happened</Field.Label>
          <Textarea
            id="edit-summary"
            size="sm"
            rows={3}
            value={values.summary}
            onInput={(e) => setValues("summary", e.currentTarget.value)}
          />
        </Field.Root>
        <button type="submit" hidden />
        <Show when={message()}>
          <p class={error} role="alert">
            {message()}
          </p>
        </Show>
      </form>
    </SimpleDialog>
  );
}
