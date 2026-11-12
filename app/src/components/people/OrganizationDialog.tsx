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
import type {
  OrganizationDetail,
  OrganizationSummary,
} from "~/lib/people/types";
import {
  createOrganizationAction,
  updateOrganizationAction,
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
const error = css({ fontSize: "sm", color: "red.11" });

/** Create (`organization` null) or edit an organization. */
export function OrganizationDialog(props: {
  organization: OrganizationDetail | null;
  onClose: () => void;
  onSaved: (o: OrganizationSummary) => void;
}) {
  const o = untrack(() => props.organization);
  const [values, setValues] = createStore({
    name: o?.name ?? "",
    kind: o?.kind ?? "",
    url: o?.url ?? "",
    summary: o?.summary ?? "",
  });
  const [message, setMessage] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const create = useAction(createOrganizationAction);
  const update = useAction(updateOrganizationAction);

  // A retry after a lost response returns the organization already created.
  const requestKey = crypto.randomUUID();
  const submit = async (e?: Event) => {
    e?.preventDefault();
    if (!values.name.trim()) return setMessage("Enter a name.");
    setBusy(true);
    try {
      const saved = o
        ? await update({ id: o.id, patch: { ...values } })
        : await create({ ...values, requestKey });
      props.onSaved(saved);
      props.onClose();
    } catch (err) {
      console.warn("[people] organization save failed", err);
      setMessage(
        saveErrorText(err, "Could not save. Your changes are kept; try again."),
      );
    } finally {
      setBusy(false);
    }
  };

  const text = (
    key: "name" | "kind" | "url",
    label: string,
    placeholder = "",
  ) => (
    <Field.Root>
      <Field.Label for={`org-${key}`}>{label}</Field.Label>
      <Input
        id={`org-${key}`}
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
      title={o ? "Edit organization" : "New organization"}
      maxW="480px"
      phoneSheet
      closeOnInteractOutside={false}
      footer={
        <HStack justify="flex-end" gap="2" w="full">
          <Button variant="outline" onClick={props.onClose}>
            Cancel
          </Button>
          <Button variant="solid" loading={busy()} onClick={() => submit()}>
            {o ? "Save" : "Add organization"}
          </Button>
        </HStack>
      }
    >
      <form class={form} onSubmit={submit}>
        {text("name", "Name")}
        <div class={row}>
          {text("kind", "Kind", "company, school, church")}
          {text("url", "Website", "https://")}
        </div>
        <Field.Root>
          <Field.Label for="org-summary">Summary</Field.Label>
          <Textarea
            id="org-summary"
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
