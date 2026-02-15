import { For } from "solid-js";
import { css } from "styled-system/css";

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function renderHighlighted(text: string, query: string) {
  const q = query.trim();
  if (!q) return text;
  const qLower = q.toLowerCase();
  const pattern = new RegExp(`(${escapeRegExp(q)})`, "ig");
  const parts = text.split(pattern);
  const markClass = css({
    bg: "amber.3",
    color: "black",
    borderRadius: "sm",
    px: "0.5",
    mx: "-0.5",
  });
  return (
    <>
      <For each={parts}>
        {(part, i) =>
          part.toLowerCase() === qLower ? (
            <mark class={markClass} data-idx={i()}>
              {part}
            </mark>
          ) : (
            <span data-idx={i()}>{part}</span>
          )
        }
      </For>
    </>
  );
}
