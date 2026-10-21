import { useAction } from "@solidjs/router";
import { createSignal, Show, untrack } from "solid-js";
import { css } from "styled-system/css";
import { editResearchCard } from "~/services/research/research.actions";
import type { ResearchCard } from "~/services/research/research.types";
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
  _focusVisible: { outline: "2px solid token(colors.blue.a8)", outlineOffset: "-1px" },
});

const autosize = (element: HTMLTextAreaElement) => {
  element.style.height = "auto";
  element.style.height = `${element.scrollHeight + 2}px`;
};

/** Edits a card's title, body, and (for sources) link as an undoable batch. */
export const CardEditForm = (props: {
  topicId: string;
  card: ResearchCard;
  onDone: (changed: boolean) => void;
}) => {
  const runEdit = useAction(editResearchCard);
  // Drafts start from the card as it was when editing began.
  const [title, setTitle] = createSignal(untrack(() => props.card.title));
  const [body, setBody] = createSignal(untrack(() => props.card.body));
  const [url, setUrl] = createSignal(untrack(() => props.card.url ?? ""));
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const isSource = () => props.card.type === "source";
  const unchanged = () =>
    title().trim() === props.card.title &&
    body() === props.card.body &&
    (!isSource() || url().trim() === (props.card.url ?? ""));

  const save = async (event: SubmitEvent) => {
    event.preventDefault();
    if (unchanged()) return props.onDone(false);
    setBusy(true);
    setError(null);
    try {
      await runEdit({
        topicId: props.topicId,
        id: props.card.id,
        title: title(),
        body: body(),
        ...(isSource() ? { url: url().trim() || null } : {}),
      });
      props.onDone(true);
    } catch (err) {
      console.error("[research-card-edit] save failed", err);
      setError("Could not save. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form class={css({ display: "flex", flexDirection: "column", gap: "1.5", mb: "2" })} onSubmit={save}>
      <input
        aria-label="Card title"
        class={fieldClass}
        value={title()}
        onInput={(event) => setTitle(event.currentTarget.value)}
      />
      <Show when={isSource()}>
        <input
          aria-label="Source link"
          placeholder="https://…"
          class={fieldClass}
          value={url()}
          onInput={(event) => setUrl(event.currentTarget.value)}
        />
      </Show>
      <textarea
        aria-label="Card body"
        placeholder="Details (markdown)"
        class={`${fieldClass} ${css({ resize: "none", minH: "20" })}`}
        value={body()}
        ref={(element) => queueMicrotask(() => autosize(element))}
        onInput={(event) => {
          setBody(event.currentTarget.value);
          autosize(event.currentTarget);
        }}
      />
      <Show when={error()}>
        {(message) => <p class={css({ fontSize: "sm", color: "red.11" })}>{message()}</p>}
      </Show>
      <div class={css({ display: "flex", justifyContent: "space-between" })}>
        <button type="button" class={textButtonClass} onClick={() => props.onDone(false)}>
          Cancel
        </button>
        <button type="submit" class={textButtonClass} disabled={busy() || !title().trim()}>
          Save
        </button>
      </div>
    </form>
  );
};
