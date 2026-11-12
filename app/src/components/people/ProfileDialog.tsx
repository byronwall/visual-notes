import { useAction } from "@solidjs/router";
import { Show, createSignal, untrack } from "solid-js";
import { createStore } from "solid-js/store";
import { css } from "styled-system/css";
import { HStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import * as Field from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import { Textarea } from "~/components/ui/textarea";
import type { PersonProfile, PersonSummary } from "~/lib/people/types";
import {
  createPersonAction,
  updatePersonAction,
} from "~/services/people/people.actions";
import { saveErrorText } from "./capture-state";

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
const hint = css({ fontSize: "xs", color: "fg.subtle" });
const error = css({ fontSize: "sm", color: "red.11" });

const splitList = (value: string) =>
  value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

/** Create a person (`person` null) or edit the profile's identity fields. */
export function ProfileDialog(props: {
  person: PersonProfile | null;
  initialName?: string;
  onClose: () => void;
  onSaved: (person: PersonSummary) => void;
}) {
  // Edits start from the profile as it was when the dialog opened.
  const p = untrack(() => props.person);
  const [values, setValues] = createStore({
    displayName: p?.displayName ?? props.initialName ?? "",
    aliases: p?.aliases.join(", ") ?? "",
    contexts: p?.contexts.join(", ") ?? "",
    location: p?.location ?? "",
    howKnown: p?.howKnown ?? "",
    summary: p?.summary ?? "",
  });
  const [message, setMessage] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const create = useAction(createPersonAction);
  const update = useAction(updatePersonAction);

  // A retry after a lost response returns the person already created.
  const requestKey = crypto.randomUUID();
  const submit = async (e?: Event) => {
    e?.preventDefault();
    if (!values.displayName.trim()) return setMessage("Enter a name.");
    const input = {
      displayName: values.displayName.trim(),
      aliases: splitList(values.aliases),
      contexts: splitList(values.contexts),
      location: values.location,
      howKnown: values.howKnown,
      summary: values.summary,
    };
    setBusy(true);
    try {
      const saved = p
        ? await update({ id: p.id, patch: input })
        : await create({ ...input, requestKey });
      props.onSaved(saved);
      props.onClose();
    } catch (err) {
      console.warn("[people] profile save failed", err);
      setMessage(
        saveErrorText(err, "Could not save. Your changes are kept; try again."),
      );
    } finally {
      setBusy(false);
    }
  };

  const text = (key: keyof typeof values, label: string, placeholder = "") => (
    <Field.Root>
      <Field.Label for={`person-${key}`}>{label}</Field.Label>
      <Input
        id={`person-${key}`}
        size="sm"
        placeholder={placeholder}
        value={values[key]}
        onInput={(e) => setValues(key, e.currentTarget.value)}
      />
    </Field.Root>
  );

  return (
    <SimpleDialog
      open
      onClose={props.onClose}
      title={p ? "Edit profile" : "New person"}
      maxW="520px"
      phoneSheet
      closeOnInteractOutside={false}
      footer={
        <HStack justify="flex-end" gap="2" w="full">
          <Button variant="outline" onClick={props.onClose}>
            Cancel
          </Button>
          <Button variant="solid" loading={busy()} onClick={() => submit()}>
            {p ? "Save" : "Add person"}
          </Button>
        </HStack>
      }
    >
      <form class={form} onSubmit={submit} data-person-form>
        {text("displayName", "Name")}
        <div class={row}>
          {text("aliases", "Also known as", "Nicknames, maiden name")}
          {text("contexts", "Contexts", "work, school, church")}
        </div>
        <span class={hint}>
          Separate several aliases or contexts with commas.
        </span>
        <div class={row}>
          {text("location", "Location")}
          {text("howKnown", "How you know them")}
        </div>
        <Field.Root>
          <Field.Label for="person-summary">Summary</Field.Label>
          <Textarea
            id="person-summary"
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
