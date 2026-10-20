import { A, useParams } from "@solidjs/router";
import { createResource } from "solid-js";
import { css } from "styled-system/css";
import { NoteGroupList, rowLinkClass } from "~/components/views/NoteGroupList";
import { ViewPageShell } from "~/components/views/ViewPageShell";
import { fetchTagBlocks } from "~/services/note-views.queries";

const textClass = css({
  flex: "1",
  minW: "0",
  lineClamp: "3",
  whiteSpace: "pre-wrap",
});

export default function TagRoute() {
  const params = useParams();
  const tag = () => decodeURIComponent(params.tag ?? "").toLowerCase();
  const [groups] = createResource(tag, fetchTagBlocks);
  const count = () =>
    (groups.latest ?? []).reduce((sum, g) => sum + g.items.length, 0);

  return (
    <ViewPageShell
      title={`#${tag()}`}
      subtitle={
        <>
          {count()} {count() === 1 ? "block" : "blocks"} ·{" "}
          <A href="/tags">All tags</A>
        </>
      }
    >
      <NoteGroupList
        groups={groups.latest ?? []}
        empty="No blocks carry this tag."
        renderItem={(block) => (
          <A href={`/docs/${block.docId}#b-${block.blockId}`} class={rowLinkClass}>
            <span class={textClass}>{block.text || "(empty block)"}</span>
          </A>
        )}
      />
    </ViewPageShell>
  );
}
