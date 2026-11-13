import { A, useAction, useSearchParams } from "@solidjs/router";
import { Show, createSignal } from "solid-js";
import { css } from "styled-system/css";
import { Button } from "~/components/ui/button";
import type { OrganizationDetail } from "~/lib/people/types";
import { updateOrganizationAction } from "~/services/people/people.actions";
import { CompanyTimeline } from "./CompanyTimeline";
import { searchNotes } from "./LinkedNotesSection";
import { siteLabel } from "./OrgHoverLink";
import { OrganizationDialog } from "./OrganizationDialog";
import { SearchPicker } from "./SearchPicker";

const layout = css({
  display: "grid",
  gap: { base: "6", lg: "8" },
  gridTemplateColumns: { base: "minmax(0, 1fr)", lg: "minmax(0, 1fr) 18rem" },
  alignItems: "start",
});
const muted = css({ color: "fg.muted", fontSize: "sm" });
const lede = css({ fontSize: "md", lineHeight: "1.55", maxW: "65ch", mb: "1" });
const small = css({ fontSize: "xs", color: "fg.subtle" });
const aside = css({
  display: "flex",
  flexDirection: "column",
  gap: "4",
  fontSize: "sm",
});
const note = css({ fontSize: "xs", color: "fg.subtle", lineHeight: "relaxed" });

/** One organization: what it is, then everyone you know there on one timeline. */
export function OrganizationView(props: { organization: OrganizationDetail }) {
  const o = () => props.organization;
  const [editing, setEditing] = createSignal(false);
  const [linking, setLinking] = createSignal(false);
  const save = useAction(updateOrganizationAction);
  const [params] = useSearchParams();
  const focusId = () => (typeof params.focus === "string" ? params.focus : null);
  const people = () => new Set(o().members.map((m) => m.id)).size;
  const facts = () =>
    [
      `${people()} ${people() === 1 ? "person" : "people"} you know`,
      o().currentMembers ? `${o().currentMembers} current` : null,
      o().pastMembers ? `${o().pastMembers} past` : null,
      o().unknownMembers ? `${o().unknownMembers} status unknown` : null,
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <div class={layout}>
      <div>
        <Show
          when={o().summary}
          fallback={
            <p class={muted}>
              No description yet.{" "}
              <Button size="xs" variant="plain" onClick={() => setEditing(true)}>
                Add one
              </Button>
            </p>
          }
        >
          <p class={lede}>{o().summary}</p>
        </Show>
        <p class={small} style={{ "margin-bottom": "1rem" }}>
          {facts()}
        </p>
        <Show
          when={o().members.length}
          fallback={<p class={muted}>No one recorded here yet.</p>}
        >
          <CompanyTimeline members={o().members} focusId={focusId()} />
        </Show>
      </div>
      <aside class={aside}>
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
                {siteLabel(url())}
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
