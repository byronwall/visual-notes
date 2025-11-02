import { For } from "solid-js";

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function renderHighlighted(text: string, query: string) {
  const q = query.trim();
  if (!q) return text;
  const pattern = new RegExp(`(${escapeRegExp(q)})`, "ig");
  const parts = text.split(pattern);
  return (
    <>
      <For each={parts}>
        {(part, i) =>
          pattern.test(part) ? (
            <mark class="bg-yellow-200 px-0.5" data-idx={i()}>
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


