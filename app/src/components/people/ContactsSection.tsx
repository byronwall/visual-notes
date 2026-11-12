import { useAction } from "@solidjs/router";
import { For, Show, createSignal, untrack } from "solid-js";
import { createStore } from "solid-js/store";
import { HStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { SimpleSelect } from "~/components/ui/simple-select";
import {
  CONTACT_KINDS,
  CONTACT_KIND_LABELS,
  contactHref,
  type ContactKind,
} from "~/lib/people/contacts";
import type { Contact } from "~/lib/people/types";
import {
  addContactAction,
  removeContactAction,
  updateContactAction,
} from "~/services/people/people.actions";
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

const KIND_ITEMS = CONTACT_KINDS.map((k) => ({
  label: CONTACT_KIND_LABELS[k],
  value: k,
}));

type Draft = { kind: ContactKind; value: string; label: string };

function ContactForm(props: {
  initial: Draft;
  onSave: (d: Draft) => Promise<void>;
  onCancel: () => void;
}) {
  const [d, setD] = createStore(untrack(() => ({ ...props.initial })));
  const [busy, setBusy] = createSignal(false);
  const [message, setMessage] = createSignal("");
  const save = async () => {
    if (!d.value.trim()) return setMessage("Enter a value.");
    setBusy(true);
    try {
      await props.onSave({ ...d });
    } catch (err) {
      console.warn("[people] contact save failed", err);
      setMessage(saveErrorText(err, "Could not save. Try again."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      class={inlineForm}
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <SimpleSelect
        items={KIND_ITEMS}
        value={d.kind}
        onChange={(v) => setD("kind", (v || "email") as ContactKind)}
        size="sm"
        skipPortal={false}
      />
      <Input
        size="sm"
        aria-label="Contact value"
        placeholder="name@example.com, 317-555-0100, https://…"
        value={d.value}
        ref={(el) => requestAnimationFrame(() => el.focus())}
        onInput={(e) => setD("value", e.currentTarget.value)}
      />
      <Input
        size="sm"
        aria-label="Contact label"
        placeholder="Label (optional): work, home, LinkedIn"
        value={d.label}
        onInput={(e) => setD("label", e.currentTarget.value)}
      />
      <Show when={message()}>
        <span class={errorText} role="alert">
          {message()}
        </span>
      </Show>
      <HStack gap="2">
        <Button size="xs" type="submit" loading={busy()}>
          Save
        </Button>
        <Button size="xs" variant="plain" onClick={props.onCancel}>
          Cancel
        </Button>
      </HStack>
    </form>
  );
}

/** Ways to reach someone; the original value is shown as entered. */
export function ContactsSection(props: {
  personId: string;
  contacts: Contact[];
}) {
  const [editing, setEditing] = createSignal<string | "new" | null>(null);
  const add = useAction(addContactAction);
  const update = useAction(updateContactAction);
  const remove = useAction(removeContactAction);
  const saveExisting = async (id: string, d: Draft) => {
    await update({ personId: props.personId, id, patch: d });
    setEditing(null);
  };
  const saveNew = async (d: Draft) => {
    await add({ personId: props.personId, input: d });
    setEditing(null);
  };

  return (
    <ProfileSection title="Contact" onAdd={() => setEditing("new")}>
      <Show when={!props.contacts.length && editing() !== "new"}>
        <span class={emptyText}>No contact methods.</span>
      </Show>
      <For each={props.contacts}>
        {(c) => (
          <Show
            when={editing() === c.id}
            fallback={
              <div class={sectionRow} data-contact={c.value}>
                <div class={rowMain}>
                  <Show when={contactHref(c.kind, c.value)} fallback={c.value}>
                    {(href) => (
                      <a href={href()} target="_blank" rel="noreferrer">
                        {c.value}
                      </a>
                    )}
                  </Show>
                  <div class={rowMeta}>
                    {[CONTACT_KIND_LABELS[c.kind], c.label]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <div class={rowActions} data-row-actions>
                  <Button
                    size="xs"
                    variant="plain"
                    onClick={() => setEditing(c.id)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="xs"
                    variant="plain"
                    onClick={() =>
                      void remove({ personId: props.personId, id: c.id })
                    }
                  >
                    Remove
                  </Button>
                </div>
              </div>
            }
          >
            <ContactForm
              initial={{ kind: c.kind, value: c.value, label: c.label ?? "" }}
              onCancel={() => setEditing(null)}
              onSave={(d) => saveExisting(c.id, d)}
            />
          </Show>
        )}
      </For>
      <Show when={editing() === "new"}>
        <ContactForm
          initial={{ kind: "email", value: "", label: "" }}
          onCancel={() => setEditing(null)}
          onSave={saveNew}
        />
      </Show>
    </ProfileSection>
  );
}
