import { A, useAction } from "@solidjs/router";
import { For, Show, createSignal } from "solid-js";
import { css } from "styled-system/css";
import { Button } from "~/components/ui/button";
import { formatPeriod, statusNote } from "~/lib/people/career-periods";
import type { OrganizationDetail } from "~/lib/people/types";
import { updateOrganizationAction } from "~/services/people/people.actions";
import { searchNotes } from "./LinkedNotesSection";
import { OrganizationDialog } from "./OrganizationDialog";
import { SearchPicker } from "./SearchPicker";

const layout = css({
  display: "grid",
  gap: { base: "6", lg: "8" },
  gridTemplateColumns: { base: "minmax(0, 1fr)", lg: "minmax(0, 1fr) 18rem" },
  alignItems: "start",
});
const sectionHead = css({
  fontSize: "sm",
  fontWeight: "semibold",
  px: "2",
  pb: "1",
  mb: "1",
  borderBottomWidth: "1px",
  borderColor: "border",
});
const member = css({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: "3",
  px: "2",
  py: "2",
  borderRadius: "l2",
  fontSize: "sm",
  _hover: { bg: "bg.subtle" },
});
const muted = css({ color: "fg.muted" });
const small = css({ fontSize: "xs", color: "fg.subtle" });
const aside = css({
  display: "flex",
  flexDirection: "column",
  gap: "4",
  fontSize: "sm",
});
const note = css({ fontSize: "xs", color: "fg.subtle", lineHeight: "relaxed" });

/** One organization: members by role, then its linked note and details. */
export function OrganizationView(props: { organization: OrganizationDetail }) {
  const o = () => props.organization;
  const [editing, setEditing] = createSignal(false);
  const [linking, setLinking] = createSignal(false);
  const save = useAction(updateOrganizationAction);
  const byStatus = (s: string) =>
    o().members.filter((m) => m.affiliation.status === s);
  const groups = () => [
    { title: "Current people", list: byStatus("current") },
    { title: "Past people", list: byStatus("ended") },
    { title: "Status unknown", list: byStatus("unknown") },
  ];

  const memberRow = (m: OrganizationDetail["members"][number]) => (
    <div class={member} data-member={m.displayName}>
      <div>
        <A href={`/people/${m.id}`}>{m.displayName}</A>
        <Show when={m.archived}>
          <span class={small}> (archived)</span>
        </Show>
        <div class={muted}>
          {m.affiliation.role ?? "No role recorded"}
          <Show when={m.affiliation.kind === "membership"}>
            <span class={small}> · membership</span>
          </Show>
        </div>
      </div>
      <span class={small} style={{ "text-align": "right" }}>
        {formatPeriod(m.affiliation)}
        <Show when={statusNote(m.affiliation)}>
          {(n) => <div>{n()}</div>}
        </Show>
      </span>
    </div>
  );

  return (
    <div class={layout}>
      <div>
        <Show when={!o().members.length}>
          <p class={muted}>No one recorded here yet.</p>
        </Show>
        <For each={groups().filter((g) => g.list.length)}>
          {(g, i) => (
            <>
              <h2
                class={sectionHead}
                style={{ "margin-top": i() ? "1.5rem" : undefined }}
              >
                {g.title} ({g.list.length})
              </h2>
              <For each={g.list}>{memberRow}</For>
            </>
          )}
        </For>
      </div>
      <aside class={aside}>
        <Show when={o().summary}>
          <div>{o().summary}</div>
        </Show>
        <Show when={o().kind}>
          <div>
            <div class={small}>Kind</div>
            {o().kind}
          </div>
        </Show>
        <Show when={o().url}>
          {(url) => (
            <div>
              <div class={small}>Website</div>
              <a href={url()} target="_blank" rel="noreferrer">
                {url()}
              </a>
            </div>
          )}
        </Show>
        <div>
          <div class={small}>Note</div>
          <Show
            when={o().note}
            fallback={
              <Show
                when={linking()}
                fallback={
                  <Button
                    size="xs"
                    variant="plain"
                    onClick={() => setLinking(true)}
                  >
                    Link a note
                  </Button>
                }
              >
                <SearchPicker
                  placeholder="Find a note by title"
                  autofocus
                  search={searchNotes}
                  onPick={(d) => {
                    setLinking(false);
                    void save({ id: o().id, patch: { docId: d.id } });
                  }}
                />
              </Show>
            }
          >
            {(n) => (
              <div>
                <A href={`/docs/${n().id}`}>{n().title || "Untitled"}</A>{" "}
                <Button
                  size="xs"
                  variant="plain"
                  onClick={() =>
                    void save({ id: o().id, patch: { docId: null } })
                  }
                >
                  Unlink
                </Button>
              </div>
            )}
          </Show>
        </div>
        <p class={note}>
          Sharing an organization records context only. It does not mean these
          people know each other.
        </p>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Button size="xs" variant="outline" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button
            size="xs"
            variant="plain"
            onClick={() =>
              void save({ id: o().id, patch: { archived: !o().archivedAt } })
            }
          >
            {o().archivedAt ? "Restore" : "Archive"}
          </Button>
        </div>
      </aside>
      <Show when={editing()}>
        <OrganizationDialog
          organization={o()}
          onClose={() => setEditing(false)}
          onSaved={() => {}}
        />
      </Show>
    </div>
  );
}
