import { useAction } from "@solidjs/router";
import { Show, createSignal, onMount, untrack } from "solid-js";
import { createStore } from "solid-js/store";
import { css } from "styled-system/css";
import { HStack } from "styled-system/jsx";
import { DateInput } from "~/components/DateInput";
import { Button } from "~/components/ui/button";
import * as Field from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import { SimpleSelect } from "~/components/ui/simple-select";
import { Textarea } from "~/components/ui/textarea";
import { todayLocal } from "~/lib/people/dates";
import {
  INTERACTION_KINDS,
  INTERACTION_KIND_LABELS,
  MENTION_KINDS,
  type InteractionKind,
} from "~/lib/people/types";
import {
  addFactAction,
  logInteractionAction,
} from "~/services/people/people.actions";
import {
  saveErrorText,
  type CaptureMode,
  type CaptureRequest,
} from "./capture-state";
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
const modes = css({
  display: "inline-flex",
  p: "0.5",
  gap: "0.5",
  bg: "bg.subtle",
  borderRadius: "l2",
  alignSelf: "flex-start",
});
const modeButton = css({
  px: "3",
  py: "1",
  fontSize: "sm",
  borderRadius: "l1",
  color: "fg.muted",
  cursor: "pointer",
  _hover: { color: "fg.default" },
  "&[aria-pressed=true]": {
    bg: "bg.default",
    color: "fg.default",
    fontWeight: "medium",
    boxShadow: "xs",
  },
});
const hint = css({ fontSize: "xs", color: "fg.subtle" });
const error = css({ fontSize: "sm", color: "red.11" });

const KIND_ITEMS = INTERACTION_KINDS.map((k) => ({
  label: INTERACTION_KIND_LABELS[k],
  value: k,
}));

/** Remember a detail or log an interaction; one save per mode. */
export function CaptureDialog(props: {
  request: CaptureRequest;
  onClose: () => void;
  onSaved?: (mode: CaptureMode) => void;
}) {
  const start = untrack(() => props.request);
  const [mode, setMode] = createSignal<CaptureMode>(start.mode);
  const [people, setPeople] = createSignal<PickedPerson[]>(
    start.people.map((p) => ({ ...p, countsAsContact: true })),
  );
  const [draft, setDraft] = createStore({
    text: "",
    category: "",
    learnedOn: "",
    source: "",
    occurredOn: todayLocal(),
    kind: "in_person" as InteractionKind,
  });
  const [message, setMessage] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const remember = useAction(addFactAction);
  const log = useAction(logInteractionAction);
  let textRef: HTMLTextAreaElement | undefined;

  onMount(() => {
    // Focus where typing starts: the text when the person is known.
    const target = people().length
      ? textRef
      : document.getElementById("capture-people");
    requestAnimationFrame(() => target?.focus());
  });

  const pickedForMode = () =>
    mode() === "fact" ? people().slice(0, 1) : people();

  const setKind = (kind: InteractionKind) => {
    setDraft("kind", kind);
    // A referral is usually about the later people, not with them.
    if (MENTION_KINDS.has(kind) && people().length > 1) {
      setPeople(people().map((p, i) => ({ ...p, countsAsContact: i === 0 })));
    }
  };

  const submit = async (e?: Event) => {
    e?.preventDefault();
    if (busy()) return;
    const picked = pickedForMode();
    if (!picked.length) return setMessage("Pick at least one person.");
    if (!draft.text.trim()) return setMessage("Write what to remember.");
    setMessage("");
    setBusy(true);
    try {
      if (mode() === "fact") {
        await remember({
          personId: picked[0].id,
          text: draft.text,
          category: draft.category || null,
          learnedOn: draft.learnedOn || null,
          sourceLabel: draft.source || null,
        });
      } else {
        if (!draft.occurredOn) throw new Error("Pick the day it happened.");
        await log({
          occurredOn: draft.occurredOn,
          kind: draft.kind,
          summary: draft.text,
          participants: picked.map((p) => ({
            personId: p.id,
            countsAsContact: p.countsAsContact,
          })),
          sourceLabel: draft.source || null,
        });
      }
      props.onSaved?.(mode());
      props.onClose();
    } catch (err) {
      // The draft stays in the form so nothing typed is lost.
      console.warn("[people] capture save failed", err);
      setMessage(
        saveErrorText(err, "Could not save. Your text is kept; try again."),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <SimpleDialog
      open
      onClose={props.onClose}
      title={mode() === "fact" ? "Remember a detail" : "Log interaction"}
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
      <form class={form} onSubmit={submit} data-people-capture>
        <div class={modes} role="group" aria-label="Capture mode">
          <button
            type="button"
            class={modeButton}
            aria-pressed={mode() === "fact"}
            onClick={() => setMode("fact")}
          >
            Remember a detail
          </button>
          <button
            type="button"
            class={modeButton}
            aria-pressed={mode() === "interaction"}
            onClick={() => setMode("interaction")}
          >
            Log interaction
          </button>
        </div>

        <Field.Root>
          <Field.Label for="capture-people">
            {mode() === "fact" ? "Person" : "People"}
          </Field.Label>
          <PersonPicker
            id="capture-people"
            value={pickedForMode()}
            onChange={setPeople}
            multiple={mode() === "interaction"}
            onError={setMessage}
          />
          <Show when={mode() === "interaction" && people().length > 1}>
            <span class={hint}>
              Only people you spoke with update last contact.
            </span>
          </Show>
        </Field.Root>

        <Show when={mode() === "interaction"}>
          <div class={row}>
            <Field.Root>
              <Field.Label for="capture-day">Day</Field.Label>
              <DateInput
                id="capture-day"
                size="sm"
                max={todayLocal()}
                value={draft.occurredOn}
                onChange={(v) => setDraft("occurredOn", v ?? "")}
              />
            </Field.Root>
            <Field.Root>
              <Field.Label>Type</Field.Label>
              <SimpleSelect
                items={KIND_ITEMS}
                value={draft.kind}
                onChange={(v) => setKind((v || "in_person") as InteractionKind)}
                size="sm"
                skipPortal={false}
              />
            </Field.Root>
          </div>
        </Show>

        <Field.Root>
          <Field.Label for="capture-text">
            {mode() === "fact" ? "Detail" : "What happened"}
          </Field.Label>
          <Textarea
            id="capture-text"
            ref={textRef}
            size="sm"
            rows={3}
            placeholder={
              mode() === "fact"
                ? "Oldest child enjoys robotics"
                : "Spoke at the fundraiser about the robotics club"
            }
            value={draft.text}
            onInput={(e) => setDraft("text", e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit();
            }}
          />
        </Field.Root>

        <div class={row}>
          <Show when={mode() === "fact"}>
            <Field.Root>
              <Field.Label for="capture-category">Category</Field.Label>
              <Input
                id="capture-category"
                size="sm"
                placeholder="Family, work, interests…"
                value={draft.category}
                onInput={(e) => setDraft("category", e.currentTarget.value)}
              />
            </Field.Root>
            <Field.Root>
              <Field.Label for="capture-learned">Learned on</Field.Label>
              <DateInput
                id="capture-learned"
                size="sm"
                max={todayLocal()}
                value={draft.learnedOn}
                onChange={(v) => setDraft("learnedOn", v ?? "")}
              />
            </Field.Root>
          </Show>
        </div>
        <Field.Root>
          <Field.Label for="capture-source">Source</Field.Label>
          <Input
            id="capture-source"
            size="sm"
            placeholder="Optional: where this came from"
            value={draft.source}
            onInput={(e) => setDraft("source", e.currentTarget.value)}
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
