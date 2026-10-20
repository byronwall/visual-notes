import { A } from "@solidjs/router";
import { For, Show, createResource } from "solid-js";
import { css } from "styled-system/css";
import { Text } from "~/components/ui/text";
import { ViewPageShell } from "~/components/views/ViewPageShell";
import { fetchTags } from "~/services/note-views.queries";

const chipClass = css({
  display: "inline-flex",
  alignItems: "baseline",
  gap: "1.5",
  px: "2",
  py: "1",
  borderWidth: "1px",
  borderColor: "gray.outline.border",
  borderRadius: "l2",
  color: "fg.default",
  textDecorationLine: "none",
  fontSize: "sm",
  _hover: { bg: "grass.a3", borderColor: "grass.a7" },
});

export default function TagsIndexRoute() {
  const [tags] = createResource(() => fetchTags());
  const list = () => tags.latest ?? [];
  return (
    <ViewPageShell
      title="Tags"
      subtitle="Every #tag used in your notes. Type # after a space in a note to add one."
    >
      <Show
        when={list().length > 0}
        fallback={
          <Text color="fg.muted" textStyle="sm">
            No tags yet.
          </Text>
        }
      >
        <div class={css({ display: "flex", flexWrap: "wrap", gap: "2" })}>
          <For each={list()}>
            {(t) => (
              <A href={`/tags/${encodeURIComponent(t.tag)}`} class={chipClass}>
                <span class={css({ color: "grass.11", fontWeight: "medium" })}>#{t.tag}</span>
                <span class={css({ color: "fg.subtle", fontSize: "xs" })}>
                  {t.blocks} in {t.notes} {t.notes === 1 ? "note" : "notes"}
                </span>
              </A>
            )}
          </For>
        </div>
      </Show>
    </ViewPageShell>
  );
}
