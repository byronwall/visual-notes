import { XIcon } from "lucide-solid";
import { For, Show, type JSX } from "solid-js";
import { css } from "styled-system/css";
import { normalizeMarkdownToHtml } from "~/server/lib/markdown";
import type { ResearchStream } from "~/services/research/research.types";
import { CardGlyph } from "../cardTypeMeta";
import type { TopicData } from "../createTopicData";
import { sectionLabelClass } from "./detailStyles";

const bodyClass = css({
  fontSize: "sm",
  color: "fg.default",
  "& p + p": { mt: "1.5" },
  "& ul": { listStyle: "disc", pl: "5" },
  "& ol": { listStyle: "decimal", pl: "5" },
  "& a": { color: "fg.link" },
});

/** A stream in the reader: goal, current answer, and its open work. */
export const StreamDetailPanel = (props: {
  data: TopicData;
  stream: ResearchStream;
  onSelect: (id: string | null) => void;
  onClose: () => void;
  children?: JSX.Element;
}) => {
  const model = () =>
    props.data
      .board()
      .columns.find((column) => column.column.id === props.stream.id);
  const open = () =>
    (model()?.order ?? [])
      .map((id) => props.data.cardsById().get(id))
      .filter((card) => card?.state === "open");
  const answerHtml = () =>
    props.stream.answer.trim()
      ? normalizeMarkdownToHtml(props.stream.answer)
      : "";

  return (
    <article aria-label="Stream details" data-testid="research-stream-detail">
      <div
        class={css({
          display: "flex",
          alignItems: "center",
          gap: "1.5",
          mb: "1",
        })}
      >
        <span class={css({ fontSize: "xs", color: "fg.muted", flex: 1 })}>
          Stream · {props.stream.key}
        </span>
        <button
          type="button"
          aria-label="Close details"
          class={css({
            display: "inline-flex",
            p: "1",
            borderRadius: "l1",
            color: "fg.muted",
            cursor: "pointer",
            _hover: { bg: "bg.hover", color: "fg.default" },
          })}
          onClick={() => props.onClose()}
        >
          <XIcon size={14} />
        </button>
      </div>
      <h2 class={css({ fontSize: "md", fontWeight: "semibold", mb: "1" })}>
        {props.stream.title}
      </h2>
      <Show when={props.stream.goal}>
        <p class={css({ fontSize: "sm", color: "fg.muted" })}>
          {props.stream.goal}
        </p>
      </Show>
      <h3 class={sectionLabelClass}>Answer</h3>
      <Show
        when={answerHtml()}
        fallback={
          <p class={css({ fontSize: "sm", color: "fg.muted" })}>
            No answer yet.
          </p>
        }
      >
        <div class={bodyClass} innerHTML={answerHtml()} />
      </Show>
      <Show when={open().length}>
        <h3 class={sectionLabelClass}>Open</h3>
        <ul class={css({ display: "flex", flexDirection: "column", gap: "1" })}>
          <For each={open()}>
            {(card) => (
              <li
                class={css({
                  display: "flex",
                  gap: "1.5",
                  alignItems: "baseline",
                })}
              >
                <CardGlyph card={card!} size={13} />
                <button
                  type="button"
                  class={css({
                    fontSize: "sm",
                    color: "fg.link",
                    textAlign: "left",
                    cursor: "pointer",
                    _hover: { color: "fg.linkHover" },
                  })}
                  onClick={() => props.onSelect(card!.id)}
                >
                  {card!.title}
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>
      {props.children}
    </article>
  );
};
