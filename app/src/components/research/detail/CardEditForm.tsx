import { useAction } from "@solidjs/router";
import { createSignal, Show, untrack } from "solid-js";
import { css } from "styled-system/css";
import { editResearchCard } from "~/services/research/research.actions";
import { SimpleSelect } from "~/components/ui/simple-select";
import type {
  ResearchCard,
  ResearchKind,
  ResearchStream,
} from "~/services/research/research.types";
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
  _focusVisible: {
    outline: "2px solid token(colors.border.focus)",
    outlineOffset: "-1px",
  },
});

const autosize = (element: HTMLTextAreaElement) => {
  element.style.height = "auto";
  element.style.height = `${element.scrollHeight + 2}px`;
};

const INHERIT = "__inherit";
const NO_KIND = "__none";

/** Edits a card's title, gist, body, kind, stream, and (for sources) link as an undoable batch. */
export const CardEditForm = (props: {
  topicId: string;
  card: ResearchCard;
  kinds: ResearchKind[];
  streams: ResearchStream[];
  onDone: (changed: boolean) => void;
}) => {
  const runEdit = useAction(editResearchCard);
  // Drafts start from the card as it was when editing began.
  const [title, setTitle] = createSignal(untrack(() => props.card.title));
  const [gist, setGist] = createSignal(untrack(() => props.card.gist));
  const [body, setBody] = createSignal(untrack(() => props.card.body));
  const streamKeyOf = (id: string | null) =>
    props.streams.find((stream) => stream.id === id)?.key ?? INHERIT;
  const [stream, setStream] = createSignal(
    untrack(() => streamKeyOf(props.card.streamId)),
  );
  const [kind, setKind] = createSignal(
    untrack(() => props.card.kind ?? NO_KIND),
  );
  const kindItems = () => [
    { value: NO_KIND, label: "No kind" },
    ...props.kinds
      .filter((entry) => entry.role === props.card.type)
      .map((entry) => ({ value: entry.key, label: entry.label })),
  ];
  const streamItems = () => [
    { value: INHERIT, label: "Inherit from the card above" },
    ...props.streams.map((entry) => ({ value: entry.key, label: entry.title })),
  ];
  const streamChanged = () => stream() !== streamKeyOf(props.card.streamId);
  const kindChanged = () => kind() !== (props.card.kind ?? NO_KIND);
  const [url, setUrl] = createSignal(untrack(() => props.card.url ?? ""));
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const isSource = () => props.card.type === "source";
  const unchanged = () =>
    title().trim() === props.card.title &&
    gist().trim() === props.card.gist &&
    body() === props.card.body &&
    !streamChanged() &&
    !kindChanged() &&
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
        gist: gist().trim(),
        body: body(),
        ...(streamChanged()
          ? { stream: stream() === INHERIT ? null : stream() }
          : {}),
        ...(kindChanged() ? { kind: kind() === NO_KIND ? null : kind() } : {}),
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

  // A native listener: Solid's delegated handlers run too late to keep Esc
  // from the page, which would close the card. An open select marks its own
  // Esc as handled, so that press closes only the select.
  const onEscape = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    if (!event.defaultPrevented && unchanged()) props.onDone(false);
  };

  return (
    <form
      class={css({
        display: "flex",
        flexDirection: "column",
        gap: "1.5",
        mb: "2",
      })}
      onSubmit={save}
      on:keydown={onEscape}
    >
      <input
        aria-label="Card title"
        class={fieldClass}
        value={title()}
        ref={(element) =>
          queueMicrotask(() => {
            element.focus();
            element.setSelectionRange(element.value.length, element.value.length);
          })
        }
        onInput={(event) => setTitle(event.currentTarget.value)}
      />
      <textarea
        aria-label="Card gist"
        placeholder="Gist: one or two sentences shown on the board"
        class={`${fieldClass} ${css({ resize: "none" })}`}
        rows={2}
        value={gist()}
        onInput={(event) => {
          setGist(event.currentTarget.value);
          autosize(event.currentTarget);
        }}
      />
      <div class={css({ display: "flex", gap: "1.5", flexWrap: "wrap" })}>
        <Show when={props.streams.length}>
          <div class={css({ flex: 1, minW: "10rem" })}>
            <SimpleSelect
              size="sm"
              label="Stream"
              labelPlacement="stacked"
              items={streamItems()}
              value={stream()}
              onChange={setStream}
              sameWidth
            />
          </div>
        </Show>
        <Show when={kindItems().length > 1}>
          <div class={css({ flex: 1, minW: "8rem" })}>
            <SimpleSelect
              size="sm"
              label="Kind"
              labelPlacement="stacked"
              items={kindItems()}
              value={kind()}
              onChange={setKind}
              sameWidth
            />
          </div>
        </Show>
      </div>
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
        {(message) => (
          <p class={css({ fontSize: "sm", color: "red.11" })}>{message()}</p>
        )}
      </Show>
      <div class={css({ display: "flex", justifyContent: "space-between" })}>
        <button
          type="button"
          class={textButtonClass}
          onClick={() => props.onDone(false)}
        >
          Cancel
        </button>
        <button
          type="submit"
          class={textButtonClass}
          disabled={busy() || !title().trim()}
        >
          Save
        </button>
      </div>
    </form>
  );
};
