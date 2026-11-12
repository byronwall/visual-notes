import { A } from "@solidjs/router";
import { For, Show } from "solid-js";
import { css } from "styled-system/css";
import { fetchDuplicateGroups } from "~/services/people/people.queries";
import { createKeptAsync } from "~/utils/kept-async";

const group = css({
  py: "2",
  px: "2",
  borderBottomWidth: "1px",
  borderColor: "border",
  fontSize: "sm",
  display: "flex",
  flexDirection: "column",
  gap: "1",
});
const reason = css({ fontSize: "xs", color: "fg.subtle" });
const links = css({ display: "flex", gap: "3", flexWrap: "wrap" });
const empty = css({
  p: "4",
  borderRadius: "l3",
  bg: "bg.subtle",
  fontSize: "sm",
  color: "fg.muted",
});

/** People who share a name or a contact value. Open one to review a merge. */
export function DuplicatesView() {
  const groups = createKeptAsync(() => fetchDuplicateGroups());
  return (
    <Show when={groups.latest}>
      {(list) => (
        <Show
          when={list().length}
          fallback={
            <div class={empty}>
              No possible duplicates. Nothing shares a name or contact.
            </div>
          }
        >
          <p class={reason}>
            A shared name or contact is only a hint: families share phones, and
            names repeat. Open a profile and use Possible duplicates → Merge to
            combine two records.
          </p>
          <For each={list()}>
            {(g) => (
              <div class={group} data-duplicate-group={g.reason}>
                <span class={reason}>{g.reason}</span>
                <div class={links}>
                  <For each={g.people}>
                    {(p) => <A href={`/people/${p.id}`}>{p.displayName}</A>}
                  </For>
                </div>
              </div>
            )}
          </For>
        </Show>
      )}
    </Show>
  );
}
