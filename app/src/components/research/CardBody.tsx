import { createMemo, Show } from "solid-js";
import { css } from "styled-system/css";
import { normalizeMarkdownToHtml } from "~/server/lib/markdown";
import type { ResearchCard } from "~/services/research/research.types";

const hostOf = (url: string) => {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
};

export const sourceLinkClass = css({
  color: "fg.link",
  textDecoration: "none",
  whiteSpace: "nowrap",
  _hover: { color: "fg.linkHover" },
});

/** Body, snippet, URL, and image for a card; renders nothing for bare titles. */
export const CardBody = (props: { card: ResearchCard; compact?: boolean }) => {
  const html = createMemo(() => (props.card.body ? normalizeMarkdownToHtml(props.card.body) : ""));
  return (
    <>
      <Show when={props.card.url}>
        {(url) => (
          <a href={url()} target="_blank" rel="noreferrer" class={sourceLinkClass}>
            {hostOf(url())}
          </a>
        )}
      </Show>
      <Show when={props.card.snippet}>
        {(snippet) => (
          <blockquote class={css({ fontSize: "sm", color: "fg.muted", fontStyle: "italic" })}>
            {snippet()}
          </blockquote>
        )}
      </Show>
      <Show when={props.card.imageUrl}>
        {(src) => (
          <img
            src={src()}
            alt=""
            loading="lazy"
            class={css({ maxW: props.compact ? "40" : "80", borderRadius: "l2", mt: "1" })}
          />
        )}
      </Show>
      <Show when={html()}>
        <div
          class={`research-card-body ${css({
            fontSize: "sm",
            color: "fg.muted",
            maxW: "prose",
            "& p + p": { mt: "1.5" },
            "& ul": { listStyle: "disc", pl: "5" },
            "& a": { color: "fg.link" },
          })}`}
          innerHTML={html()}
        />
      </Show>
    </>
  );
};
