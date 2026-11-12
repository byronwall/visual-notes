import { useAction, useNavigate } from "@solidjs/router";
import { For, Show, createResource, createSignal } from "solid-js";
import { css } from "styled-system/css";
import { HStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import type { PersonProfile } from "~/lib/people/types";
import { mergePeopleAction } from "~/services/people/people.actions";
import { fetchPerson } from "~/services/people/people.queries";
import { onDemand } from "~/utils/kept-async";
import { saveErrorText } from "./capture-state";

const FIELDS = [
  ["displayName", "Name"],
  ["summary", "Summary"],
  ["location", "Location"],
  ["howKnown", "How you know them"],
] as const;
type MergeField = (typeof FIELDS)[number][0];

const body = css({
  display: "flex",
  flexDirection: "column",
  gap: "3",
  w: "full",
  fontSize: "sm",
});
const sides = css({
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "2",
});
const side = css({
  p: "2.5",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "l2",
  cursor: "pointer",
  textAlign: "left",
  "&[aria-pressed=true]": { borderColor: "fg.default", bg: "bg.subtle" },
});
const conflict = css({
  display: "grid",
  gridTemplateColumns: "7rem 1fr 1fr",
  gap: "2",
  alignItems: "center",
});
const choice = css({
  p: "1.5",
  borderRadius: "l1",
  borderWidth: "1px",
  borderColor: "border",
  textAlign: "left",
  cursor: "pointer",
  "&[aria-pressed=true]": { borderColor: "fg.default", bg: "bg.subtle" },
});
const muted = css({ color: "fg.muted", fontSize: "xs" });
const error = css({ color: "red.11" });

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const counts = (p: PersonProfile) =>
  [
    plural(p.facts.length, "fact"),
    plural(p.interactions.length, "encounter"),
    plural(p.contacts.length, "contact"),
  ].join(" · ");

/** Review a merge: pick the surviving profile and any fields to take over. */
export function MergeDialog(props: {
  a: PersonProfile;
  otherId: string;
  onClose: () => void;
}) {
  const [other] = createResource(
    () => props.otherId,
    (id) => fetchPerson(id),
    onDemand,
  );
  const [survivorIsA, setSurvivorIsA] = createSignal(true);
  const [take, setTake] = createSignal<MergeField[]>([]);
  const [busy, setBusy] = createSignal(false);
  const [message, setMessage] = createSignal("");
  const merge = useAction(mergePeopleAction);
  const navigate = useNavigate();

  const pair = () => {
    const b = other.latest;
    if (!b) return null;
    return survivorIsA()
      ? { survivor: props.a, dup: b }
      : { survivor: b, dup: props.a };
  };
  const differing = () => {
    const p = pair();
    if (!p) return [];
    return FIELDS.filter(
      ([f]) => p.dup[f] && p.survivor[f] && p.dup[f] !== p.survivor[f],
    );
  };
  const toggle = (f: MergeField, fromDup: boolean) =>
    setTake((t) =>
      fromDup ? [...t.filter((x) => x !== f), f] : t.filter((x) => x !== f),
    );

  const submit = async () => {
    const p = pair();
    if (!p) return;
    setBusy(true);
    try {
      await merge({
        survivorId: p.survivor.id,
        duplicateId: p.dup.id,
        take: take(),
      });
      props.onClose();
      navigate(`/people/${p.survivor.id}`);
    } catch (err) {
      console.warn("[people] merge failed", err);
      setMessage(saveErrorText(err, "Could not merge. Nothing was changed."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SimpleDialog
      open
      onClose={props.onClose}
      title="Merge people"
      maxW="600px"
      phoneSheet
      closeOnInteractOutside={false}
      footer={
        <HStack justify="flex-end" gap="2" w="full">
          <Button variant="outline" onClick={props.onClose}>
            Cancel
          </Button>
          <Button
            loading={busy()}
            disabled={!pair()}
            onClick={() => void submit()}
          >
            Merge
          </Button>
        </HStack>
      }
    >
      <Show when={pair()} fallback={<p>Loading…</p>}>
        {(p) => (
          <div class={body}>
            <span>
              Keep which profile? The other one moves into it and is archived.
            </span>
            <div class={sides}>
              <For each={[props.a, other.latest!]}>
                {(person, i) => (
                  <button
                    type="button"
                    class={side}
                    aria-pressed={survivorIsA() === (i() === 0)}
                    onClick={() => {
                      setSurvivorIsA(i() === 0);
                      setTake([]);
                    }}
                  >
                    <strong>{person.displayName}</strong>
                    <div class={muted}>{counts(person)}</div>
                  </button>
                )}
              </For>
            </div>
            <Show when={differing().length}>
              <span>These fields differ. Pick the value to keep:</span>
              <For each={differing()}>
                {([f, label]) => (
                  <div class={conflict}>
                    <span class={muted}>{label}</span>
                    <button
                      type="button"
                      class={choice}
                      aria-pressed={!take().includes(f)}
                      onClick={() => toggle(f, false)}
                    >
                      {p().survivor[f]}
                    </button>
                    <button
                      type="button"
                      class={choice}
                      aria-pressed={take().includes(f)}
                      onClick={() => toggle(f, true)}
                    >
                      {p().dup[f]}
                    </button>
                  </div>
                )}
              </For>
            </Show>
            <span class={muted}>
              Facts, contacts, roles, linked notes, encounters, and import
              identities all move. A shared encounter keeps one participant. The
              other name becomes an alias.
            </span>
            <Show when={message()}>
              <span class={error} role="alert">
                {message()}
              </span>
            </Show>
          </div>
        )}
      </Show>
    </SimpleDialog>
  );
}
