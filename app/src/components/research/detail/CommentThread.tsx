import { useAction } from "@solidjs/router";
import { createSignal, For, Show } from "solid-js";
import { css } from "styled-system/css";
import { formatRelativeShort } from "~/components/doc-header/relative-time";
import {
  addResearchComment,
  setResearchCommentResolved,
} from "~/services/research/research.actions";
import { agentLabel } from "~/services/research/research.graph";
import type { ResearchComment } from "~/services/research/research.types";
import type { TopicData } from "../createTopicData";
import { sectionLabelClass, textButtonClass } from "./detailStyles";

const fieldClass = css({
  w: "full",
  px: "2",
  py: "1.5",
  fontSize: "sm",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "l2",
  bg: "bg.default",
  resize: "none",
  minH: "9",
  _focusVisible: {
    outline: "2px solid token(colors.border.focus)",
    outlineOffset: "-1px",
  },
});

const autosize = (element: HTMLTextAreaElement) => {
  element.style.height = "auto";
  element.style.height = `${element.scrollHeight + 2}px`;
};

/**
 * Notes for the next agent pass on a card or stream. The agent sees open
 * comments in research_get_topic and resolves them with what it changed.
 */
export const CommentThread = (props: {
  data: TopicData;
  cardId?: string;
  streamId?: string;
}) => {
  const runAdd = useAction(addResearchComment);
  const runResolve = useAction(setResearchCommentResolved);
  const [draft, setDraft] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  let input: HTMLTextAreaElement | undefined;
  const topicId = () => props.data.current()?.topic.id ?? "";
  const nowMs = () => Date.parse(props.data.current()?.generatedAt ?? "") || 0;
  const comments = (): ResearchComment[] =>
    (props.data.current()?.comments ?? []).filter((comment) =>
      props.cardId
        ? comment.cardId === props.cardId
        : comment.streamId === props.streamId && !comment.cardId,
    );

  const submit = async () => {
    const body = draft().trim();
    if (!body || busy()) return;
    setBusy(true);
    setError(null);
    try {
      await runAdd({
        topicId: topicId(),
        cardId: props.cardId ?? null,
        streamId: props.streamId ?? null,
        body,
      });
      setDraft("");
      if (input) autosize(input);
      props.data.reload();
    } catch (err) {
      console.error("[research-comment] add failed", err);
      setError("Could not save the comment. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (comment: ResearchComment) => {
    await runResolve({
      topicId: topicId(),
      id: comment.id,
      resolved: !comment.resolvedAt,
    });
    props.data.reload();
  };

  return (
    <section aria-label="Comments" data-testid="research-comments">
      <h3 class={sectionLabelClass}>Comments for the agent</h3>
      <ul
        class={css({
          display: "flex",
          flexDirection: "column",
          gap: "2",
          mb: "2",
        })}
      >
        <For each={comments()}>
          {(comment) => (
            <li
              data-testid="research-comment"
              data-resolved={Boolean(comment.resolvedAt)}
            >
              <p
                class={css({
                  fontSize: "sm",
                  whiteSpace: "pre-wrap",
                  color: comment.resolvedAt ? "fg.muted" : "fg.default",
                })}
              >
                {comment.body}
              </p>
              <Show when={comment.resolution}>
                <p
                  class={css({ fontSize: "sm", color: "fg.muted", mt: "0.5" })}
                >
                  ↳ {comment.resolution}
                </p>
              </Show>
              <div
                class={css({
                  display: "flex",
                  alignItems: "center",
                  gap: "2",
                  fontSize: "xs",
                  color: "fg.muted",
                  mt: "0.5",
                })}
              >
                <span>
                  {agentLabel(comment.author)} ·{" "}
                  {formatRelativeShort(nowMs(), comment.createdAt)}
                  {comment.resolvedAt ? " · resolved" : " · open"}
                </span>
                <button
                  type="button"
                  class={textButtonClass}
                  onClick={() => toggle(comment)}
                >
                  {comment.resolvedAt ? "Reopen" : "Resolve"}
                </button>
              </div>
            </li>
          )}
        </For>
      </ul>
      <textarea
        ref={input}
        aria-label="New comment"
        placeholder="Leave a note for the next agent pass…"
        class={fieldClass}
        rows={1}
        value={draft()}
        onInput={(event) => {
          setDraft(event.currentTarget.value);
          autosize(event.currentTarget);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            void submit();
          }
        }}
      />
      <div
        class={css({
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mt: "1",
          minH: "7",
        })}
      >
        <span
          class={css({
            fontSize: "xs",
            color: error() ? "red.11" : "fg.subtle",
          })}
        >
          {error() ?? "⌘↵ to add"}
        </span>
        <button
          type="button"
          class={textButtonClass}
          disabled={!draft().trim() || busy()}
          onClick={() => void submit()}
        >
          Add comment
        </button>
      </div>
    </section>
  );
};
