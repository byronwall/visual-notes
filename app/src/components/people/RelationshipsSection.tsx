import { A, useAction } from "@solidjs/router";
import { For, Show, createSignal } from "solid-js";
import { HStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { SimpleSelect } from "~/components/ui/simple-select";
import {
  RELATIONSHIP_KINDS,
  RELATIONSHIP_TYPES,
  type RelationshipKind,
} from "~/lib/people/relationships";
import {
  addRelationshipAction,
  updateRelationshipAction,
} from "~/services/people/people.actions";
import {
  fetchPersonCandidates,
  fetchRelationships,
} from "~/services/people/people.queries";
import { createKeptAsync, onDemand } from "~/utils/kept-async";
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
import { SearchPicker, type PickItem } from "./SearchPicker";

const TYPE_ITEMS = RELATIONSHIP_KINDS.map((k) => ({
  label: RELATIONSHIP_TYPES[k].label,
  value: k,
}));

const searchPeople = async (q: string): Promise<PickItem[]> =>
  (await fetchPersonCandidates(q)).map((p) => ({
    id: p.id,
    label: p.displayName,
    meta: p.currentRole,
  }));

/** Explicit relationships to other people, entered here before any graph. */
export function RelationshipsSection(props: {
  personId: string;
  name: string;
}) {
  const list = createKeptAsync(
    () => fetchRelationships(props.personId),
    onDemand,
  );
  const add = useAction(addRelationshipAction);
  const update = useAction(updateRelationshipAction);
  const [adding, setAdding] = createSignal(false);
  const [type, setType] = createSignal<RelationshipKind>("friend");
  const [other, setOther] = createSignal<PickItem | null>(null);
  const [source, setSource] = createSignal("");
  const [message, setMessage] = createSignal("");

  const save = async (e: Event) => {
    e.preventDefault();
    const o = other();
    if (!o) return setMessage("Pick a person.");
    try {
      await add({
        fromPersonId: props.personId,
        toPersonId: o.id,
        type: type(),
        source: source(),
      });
      setAdding(false);
      setOther(null);
      setSource("");
      setMessage("");
    } catch (err) {
      console.warn("[people] relationship save failed", err);
      setMessage(saveErrorText(err, "Could not save. Try again."));
    }
  };

  return (
    <ProfileSection title="Relationships" onAdd={() => setAdding(true)}>
      <Show when={!list.latest?.length && !adding()}>
        <span class={emptyText}>No relationships recorded.</span>
      </Show>
      <For each={list.latest}>
        {(r) => (
          <div class={sectionRow} data-relationship={r.other.displayName}>
            <div class={rowMain}>
              <span class={rowMeta}>{r.label} </span>
              <A href={`/people/${r.other.id}`}>{r.other.displayName}</A>
              <Show when={r.source}>
                <div class={rowMeta}>Source: {r.source}</div>
              </Show>
            </div>
            <div class={rowActions} data-row-actions>
              <Button
                size="xs"
                variant="plain"
                onClick={() =>
                  void update({
                    id: r.id,
                    viewerId: props.personId,
                    archived: true,
                  })
                }
              >
                Archive
              </Button>
            </div>
          </div>
        )}
      </For>
      <Show when={list.latest?.length}>
        <A href={`/people/network?focus=${props.personId}`} class={rowMeta}>
          Open network →
        </A>
      </Show>
      <Show when={adding()}>
        <form class={inlineForm} onSubmit={save}>
          <span class={rowMeta}>{props.name} is…</span>
          <SimpleSelect
            size="sm"
            skipPortal={false}
            items={TYPE_ITEMS}
            value={type()}
            onChange={(v) => setType((v || "friend") as RelationshipKind)}
          />
          <Show
            when={other()}
            fallback={
              <SearchPicker
                placeholder="Person"
                autofocus
                search={searchPeople}
                onPick={setOther}
              />
            }
          >
            {(o) => (
              <HStack gap="2" fontSize="sm">
                <strong>{o().label}</strong>
                <Button
                  size="xs"
                  variant="plain"
                  onClick={() => setOther(null)}
                >
                  Change
                </Button>
              </HStack>
            )}
          </Show>
          <Input
            size="sm"
            aria-label="Relationship source"
            placeholder="Source (optional): how you know this"
            value={source()}
            onInput={(e) => setSource(e.currentTarget.value)}
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
            <Button size="xs" variant="plain" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </HStack>
        </form>
      </Show>
    </ProfileSection>
  );
}
