import { useAction } from "@solidjs/router";
import { Show, createSignal, untrack } from "solid-js";
import { css } from "styled-system/css";
import { HStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { formatDay, todayLocal } from "~/lib/people/dates";
import type { Fact } from "~/lib/people/types";
import { updateFactAction } from "~/services/people/people.actions";
import { saveErrorText } from "./capture-state";

const item = css({
  display: "flex",
  gap: "3",
  alignItems: "flex-start",
  px: "2",
  py: "2",
  borderRadius: "l2",
  _hover: { bg: "bg.subtle" },
  "&:hover [data-fact-actions]": { opacity: 1 },
  "&:focus-within [data-fact-actions]": { opacity: 1 },
});
const body = css({ flex: "1", minW: "0" });
const text = css({
  fontSize: "sm",
  lineHeight: "relaxed",
  whiteSpace: "pre-wrap",
});
const meta = css({ fontSize: "xs", color: "fg.subtle", mt: "0.5" });
const category = css({
  fontSize: "xs",
  color: "fg.muted",
  bg: "bg.muted",
  px: "1.5",
  borderRadius: "l1",
  mr: "1.5",
});
const actions = css({
  display: "flex",
  gap: "1",
  opacity: { base: 1, md: 0 },
  transition: "opacity 0.1s",
});
const error = css({ fontSize: "xs", color: "red.11", mt: "1" });

/** One current fact, editable in place and retirable. */
export function FactItem(props: { fact: Fact }) {
  const [editing, setEditing] = createSignal(false);
  const [draft, setDraft] = createSignal(untrack(() => props.fact.text));
  const [message, setMessage] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const save = useAction(updateFactAction);

  const run = async (patch: { text?: string; retired?: boolean }) => {
    setBusy(true);
    setMessage("");
    try {
      await save({ id: props.fact.id, patch });
      setEditing(false);
    } catch (err) {
      console.warn("[people] fact save failed", err);
      setMessage(saveErrorText(err, "Could not save this detail. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const source = () =>
    [
      props.fact.learnedOn
        ? `Learned ${formatDay(props.fact.learnedOn)}`
        : `Recorded ${formatDay(todayLocal(new Date(props.fact.createdAt)))}`,
      props.fact.sourceLabel,
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <div class={item} data-fact={props.fact.text}>
      <div class={body}>
        <Show
          when={editing()}
          fallback={
            <>
              <div class={text}>
                <Show when={props.fact.category}>
                  <span class={category}>{props.fact.category}</span>
                </Show>
                {props.fact.text}
              </div>
              <div class={meta}>{source()}</div>
            </>
          }
        >
          <Textarea
            size="sm"
            rows={2}
            aria-label="Edit detail"
            value={draft()}
            onInput={(e) => setDraft(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditing(false);
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                void run({ text: draft() });
              }
            }}
            ref={(el) => requestAnimationFrame(() => el.focus())}
          />
          <HStack gap="2" mt="1.5">
            <Button
              size="xs"
              loading={busy()}
              onClick={() => run({ text: draft() })}
            >
              Save
            </Button>
            <Button size="xs" variant="plain" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </HStack>
        </Show>
        <Show when={message()}>
          <div class={error} role="alert">
            {message()}
          </div>
        </Show>
      </div>
      <Show when={!editing()}>
        <div class={actions} data-fact-actions>
          <Button
            size="xs"
            variant="plain"
            onClick={() => {
              setDraft(props.fact.text);
              setEditing(true);
            }}
          >
            Edit
          </Button>
          <Button
            size="xs"
            variant="plain"
            disabled={busy()}
            title="Move to history as no longer true"
            onClick={() => run({ retired: true })}
          >
            Retire
          </Button>
        </div>
      </Show>
    </div>
  );
}
