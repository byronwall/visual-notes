import { For } from "solid-js";
import { css } from "styled-system/css";
import { splitByTokens } from "./highlight-tokens";

const markClass = css({
  bg: "bg.highlight",
  color: "inherit",
  borderRadius: "l1",
  px: "0.5",
  mx: "-0.5",
});

/** Renders text with each search token wrapped in a subtle highlight. */
export const HighlightMatch = (props: { text: string; query: string }) => (
  <For each={splitByTokens(props.text, props.query)}>
    {(part) => (part.match ? <mark class={markClass}>{part.text}</mark> : <>{part.text}</>)}
  </For>
);
