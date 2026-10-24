import { useAction } from "@solidjs/router";
import { createSignal, Show } from "solid-js";
import { css } from "styled-system/css";
import {
  discardResearchSummary,
  setResearchSummaryStatus,
  updateResearchSummary,
} from "~/services/research/research.actions";
import type { ResearchCard, ResearchSummaryGroup } from "~/services/research/research.types";
import { textButtonClass } from "./detailStyles";

const fieldClass = css({
  w: "full",
  px: "2",
  py: "1",
  fontSize: "sm",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "l2",
  bg: "bg.default",
  _focusVisible: { outline: "2px solid token(colors.border.focus)", outlineOffset: "-1px" },
});

const autosize = (element: HTMLTextAreaElement) => {
  element.style.height = "auto";
  element.style.height = `${element.scrollHeight + 2}px`;
};

/** Accept, edit, un-accept, or discard a summary. Editing a draft accepts it. */
export const SummaryReview = (props: {
  card: ResearchCard;
  group: ResearchSummaryGroup;
  onChanged: () => void;
  onDiscarded: () => void;
}) => {
  const runStatus = useAction(setResearchSummaryStatus);
  const runUpdate = useAction(updateResearchSummary);
  const runDiscard = useAction(discardResearchSummary);
  const [editing, setEditing] = createSignal(false);
  const cardCount = () => props.group.memberIds.length;
  const [title, setTitle] = createSignal("");
  const [body, setBody] = createSignal("");
  const [busy, setBusy] = createSignal(false);

  const setStatus = async (status: "draft" | "accepted") => {
    setBusy(true);
    try {
      await runStatus({ groupId: props.group.id, status });
      props.onChanged();
    } finally {
      setBusy(false);
    }
  };

  const discard = async () => {
    setBusy(true);
    try {
      await runDiscard({ groupId: props.group.id });
      props.onDiscarded();
    } finally {
      setBusy(false);
    }
  };

  const save = async (event: SubmitEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await runUpdate({ groupId: props.group.id, title: title(), body: body() });
      setEditing(false);
      props.onChanged();
    } finally {
      setBusy(false);
    }
  };

  const startEdit = () => {
    setTitle(props.card.title);
    setBody(props.card.body);
    setEditing(true);
  };

  return (
    <div class={css({ mt: "2" })}>
      <p class={css({ fontSize: "sm", color: "fg.muted" })}>
        <Show
          when={props.group.status === "draft"}
          fallback={<>Accepted. Its {cardCount()} cards collapse into this one when you zoom out to Summaries.</>}
        >
          <span class={css({ color: "amber.11", fontWeight: "medium" })}>Draft summary.</span> An agent wrote this
          roll-up of {cardCount()} cards. Accept it if it reads right, and those cards collapse into this one when you
          zoom out.
        </Show>
      </p>
      <Show
        when={editing()}
        fallback={
          <div class={css({ display: "flex", gap: "1", mt: "1.5", flexWrap: "wrap" })}>
            <Show
              when={props.group.status === "draft"}
              fallback={
                <button type="button" class={textButtonClass} disabled={busy()} onClick={() => setStatus("draft")}>
                  Back to draft
                </button>
              }
            >
              <button type="button" class={textButtonClass} disabled={busy()} onClick={() => setStatus("accepted")}>
                Accept
              </button>
            </Show>
            <button type="button" class={textButtonClass} disabled={busy()} onClick={startEdit}>
              Edit
            </button>
            <button type="button" class={textButtonClass} data-tone="danger" disabled={busy()} onClick={discard}>
              Discard
            </button>
          </div>
        }
      >
        <form class={css({ display: "flex", flexDirection: "column", gap: "1.5", mt: "1.5" })} onSubmit={save}>
          <input
            aria-label="Summary title"
            class={fieldClass}
            value={title()}
            onInput={(e) => setTitle(e.currentTarget.value)}
          />
          <textarea
            aria-label="Summary body"
            class={`${fieldClass} ${css({ resize: "none", minH: "20" })}`}
            value={body()}
            ref={(element) => queueMicrotask(() => autosize(element))}
            onInput={(event) => {
              setBody(event.currentTarget.value);
              autosize(event.currentTarget);
            }}
          />
          <div class={css({ display: "flex", justifyContent: "space-between" })}>
            <button type="button" class={textButtonClass} onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button type="submit" class={textButtonClass} disabled={busy() || !title().trim()}>
              Save and accept
            </button>
          </div>
        </form>
      </Show>
    </div>
  );
};
