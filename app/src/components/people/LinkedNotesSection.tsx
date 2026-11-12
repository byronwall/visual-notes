import { A, useAction } from "@solidjs/router";
import { For, Show, createSignal } from "solid-js";
import { Button } from "~/components/ui/button";
import type { LinkedNote } from "~/lib/people/types";
import { linkNoteAction } from "~/services/people/people.actions";
import { fetchNoteCandidates } from "~/services/people/people.queries";
import {
  ProfileSection,
  emptyText,
  errorText,
  rowActions,
  rowMain,
  rowMeta,
  sectionRow,
} from "./profile-section";
import { SearchPicker } from "./SearchPicker";

export const searchNotes = async (q: string) =>
  (await fetchNoteCandidates(q)).map((d) => ({
    id: d.id,
    label: d.title || "Untitled",
    meta: d.path,
  }));

/** Notes deliberately linked for context. The notes themselves are unchanged. */
export function LinkedNotesSection(props: {
  personId: string;
  notes: LinkedNote[];
}) {
  const [adding, setAdding] = createSignal(false);
  const [message, setMessage] = createSignal("");
  const link = useAction(linkNoteAction);

  const run = async (docId: string, linked: boolean) => {
    try {
      await link({ personId: props.personId, docId, linked });
      setAdding(false);
      setMessage("");
    } catch (err) {
      console.warn("[people] note link failed", err);
      setMessage("Could not update the linked note. Try again.");
    }
  };

  return (
    <ProfileSection
      title="Linked notes"
      addLabel="Link"
      onAdd={() => setAdding(true)}
    >
      <Show when={!props.notes.length && !adding()}>
        <span class={emptyText}>No linked notes.</span>
      </Show>
      <For each={props.notes}>
        {(n) => (
          <div class={sectionRow} data-linked-note={n.title}>
            <div class={rowMain}>
              <A href={`/docs/${n.id}`}>{n.title || "Untitled"}</A>
              <Show when={n.path}>
                <div class={rowMeta}>{n.path}</div>
              </Show>
            </div>
            <div class={rowActions} data-row-actions>
              <Button
                size="xs"
                variant="plain"
                onClick={() => void run(n.id, false)}
              >
                Unlink
              </Button>
            </div>
          </div>
        )}
      </For>
      <Show when={adding()}>
        <SearchPicker
          placeholder="Find a note by title"
          autofocus
          search={searchNotes}
          onPick={(d) => void run(d.id, true)}
        />
        <Button
          size="xs"
          variant="plain"
          alignSelf="flex-start"
          onClick={() => setAdding(false)}
        >
          Cancel
        </Button>
      </Show>
      <Show when={message()}>
        <span class={errorText} role="alert">
          {message()}
        </span>
      </Show>
    </ProfileSection>
  );
}
