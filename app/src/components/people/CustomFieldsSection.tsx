import { useAction } from "@solidjs/router";
import { For, Show, createSignal } from "solid-js";
import { HStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { updatePersonAction } from "~/services/people/people.actions";
import { saveErrorText } from "./capture-state";
import {
  ProfileSection,
  emptyText,
  errorText,
  inlineForm,
  rowActions,
  rowMain,
  rowMeta,
  sectionRow,
} from "./profile-section";

/** User-named attributes ("Birthday": "May 4"); simple key/value text. */
export function CustomFieldsSection(props: {
  personId: string;
  fields: Record<string, string>;
}) {
  const [editing, setEditing] = createSignal<string | "new" | null>(null);
  const [key, setKey] = createSignal("");
  const [value, setValue] = createSignal("");
  const [message, setMessage] = createSignal("");
  const save = useAction(updatePersonAction);
  const entries = () => Object.entries(props.fields);

  const write = async (next: Record<string, string>) => {
    try {
      await save({ id: props.personId, patch: { customFields: next } });
      setEditing(null);
      setMessage("");
    } catch (err) {
      console.warn("[people] custom field save failed", err);
      setMessage(saveErrorText(err, "Could not save. Try again."));
    }
  };

  const start = (k: string | "new") => {
    setKey(k === "new" ? "" : k);
    setValue(k === "new" ? "" : props.fields[k] ?? "");
    setEditing(k);
  };

  const submit = (e: Event) => {
    e.preventDefault();
    const k = key().trim();
    if (!k) return setMessage("Name the field.");
    const next = { ...props.fields };
    const old = editing();
    if (old && old !== "new" && old !== k) delete next[old];
    next[k] = value();
    void write(next);
  };

  const form = () => (
    <form class={inlineForm} onSubmit={submit}>
      <Input
        size="sm"
        aria-label="Field name"
        placeholder="Field, e.g. Birthday"
        value={key()}
        ref={(el) => requestAnimationFrame(() => el.focus())}
        onInput={(e) => setKey(e.currentTarget.value)}
      />
      <Input
        size="sm"
        aria-label="Field value"
        placeholder="Value"
        value={value()}
        onInput={(e) => setValue(e.currentTarget.value)}
      />
      <Show when={message()}>
        <span class={errorText} role="alert">
          {message()}
        </span>
      </Show>
      <HStack gap="2">
        <Button size="xs" type="submit">
          Save
        </Button>
        <Button size="xs" variant="plain" onClick={() => setEditing(null)}>
          Cancel
        </Button>
      </HStack>
    </form>
  );

  return (
    <ProfileSection title="Other details" onAdd={() => start("new")}>
      <Show when={!entries().length && editing() !== "new"}>
        <span class={emptyText}>No other details.</span>
      </Show>
      <For each={entries()}>
        {([k, v]) => (
          <Show
            when={editing() === k}
            fallback={
              <div class={sectionRow} data-custom-field={k}>
                <div class={rowMain}>
                  <div class={rowMeta}>{k}</div>
                  {v || "—"}
                </div>
                <div class={rowActions} data-row-actions>
                  <Button size="xs" variant="plain" onClick={() => start(k)}>
                    Edit
                  </Button>
                  <Button
                    size="xs"
                    variant="plain"
                    onClick={() => {
                      const next = { ...props.fields };
                      delete next[k];
                      void write(next);
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            }
          >
            {form()}
          </Show>
        )}
      </For>
      <Show when={editing() === "new"}>{form()}</Show>
    </ProfileSection>
  );
}
