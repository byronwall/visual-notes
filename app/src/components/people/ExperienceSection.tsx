import { useAction } from "@solidjs/router";
import { For, Show, createSignal } from "solid-js";
import { css } from "styled-system/css";
import { Button } from "~/components/ui/button";
import type { Affiliation, Colleague } from "~/lib/people/types";
import {
  addAffiliationAction,
  removeAffiliationAction,
  updateAffiliationAction,
} from "~/services/people/people.actions";
import { groupSpan } from "~/lib/people/career-periods";
import { ExperienceRole } from "./ExperienceRole";
import { OrgHoverLink } from "./OrgHoverLink";
import { OrgMark } from "./OrgMark";
import { OverlapRow } from "./OverlapRow";
import { RoleForm } from "./RoleForm";
import { draftOf, emptyDraft, patchOf, type RoleDraft } from "./role-draft";

const group = css({
  display: "grid",
  gridTemplateColumns: "2.75rem minmax(0, 1fr)",
  columnGap: "3",
  py: "3",
  borderBottomWidth: "1px",
  borderColor: "border",
  _last: { borderBottomWidth: "0" },
});
const company = css({
  fontSize: "md",
  fontWeight: "semibold",
  lineHeight: "1.4",
  "& a": { color: "fg.default" },
  "& a:hover": { textDecoration: "underline" },
});
const span = css({ ml: "2", fontSize: "sm", fontWeight: "normal", color: "fg.muted" });
const roles = css({ display: "flex", flexDirection: "column", mt: "1" });
const empty = css({ fontSize: "sm", color: "fg.muted", px: "2", py: "2" });

/** Consecutive roles at one organization; a later return starts a new group. */
export function groupRoles(list: Affiliation[]) {
  const groups: { orgId: string; roles: Affiliation[] }[] = [];
  for (const a of list) {
    const last = groups.at(-1);
    if (last && last.orgId === a.organization.id) last.roles.push(a);
    else groups.push({ orgId: a.organization.id, roles: [a] });
  }
  return groups;
}

/**
 * A person's jobs, newest start first, grouped under each employer like a
 * résumé. Each role keeps its own dates, status, and source; colleagues at
 * the same employer show with an explained overlap.
 */
export function ExperienceSection(props: {
  personId: string;
  roles: Affiliation[];
  colleagues: Colleague[];
}) {
  const [editing, setEditing] = createSignal<string | "new" | null>(null);
  const add = useAction(addAffiliationAction);
  const update = useAction(updateAffiliationAction);
  const remove = useAction(removeAffiliationAction);
  const saveExisting = async (id: string, d: RoleDraft) => {
    await update({ personId: props.personId, id, patch: patchOf(d) });
    setEditing(null);
  };
  const saveNew = async (d: RoleDraft) => {
    await add({
      personId: props.personId,
      input: { organizationId: d.organization!.id, ...patchOf(d) },
    });
    setEditing(null);
  };
  const end = (a: Affiliation) =>
    void update({
      personId: props.personId,
      id: a.id,
      patch: { status: "ended" },
    });
  const knownNote = (orgId: string) => {
    const n = new Set(
      props.colleagues
        .filter((c) => c.other.organization.id === orgId)
        .map((c) => c.person.id),
    ).size;
    return n ? `${n} other ${n === 1 ? "person" : "people"} you know worked here` : null;
  };
  const colleaguesOf = (ids: string[]) =>
    props.colleagues.filter((c) => ids.includes(c.affiliationId));

  return (
    <section aria-labelledby="experience-heading" data-experience>
      <div
        class={css({
          display: "flex",
          alignItems: "center",
          gap: "2",
          px: "2",
          pb: "1",
          borderBottomWidth: "1px",
          borderColor: "border",
        })}
      >
        <h2
          id="experience-heading"
          class={css({ fontSize: "sm", fontWeight: "semibold", flex: "1" })}
        >
          Experience
        </h2>
        <Button size="xs" variant="outline" onClick={() => setEditing("new")}>
          Add role
        </Button>
      </div>
      <Show when={editing() === "new"}>
        <div class={css({ py: "2" })}>
          <RoleForm
            lockOrganization={false}
            initial={emptyDraft("employment")}
            onCancel={() => setEditing(null)}
            onSave={saveNew}
          />
        </div>
      </Show>
      <Show when={!props.roles.length && editing() !== "new"}>
        <div class={empty}>No work history recorded.</div>
      </Show>
      <For each={groupRoles(props.roles)}>
        {(g) => {
          const org = g.roles[0].organization;
          const many = g.roles.length > 1;
          return (
            <div class={group} data-experience-group={org.name}>
              <OrgMark org={org} size={44} />
              <div>
                <div class={company}>
                  <OrgHoverLink org={org} note={knownNote(org.id)}>
                    {org.name}
                  </OrgHoverLink>
                  <Show when={many && groupSpan(g.roles)}>
                    {(text) => <span class={span}>{text()}</span>}
                  </Show>
                </div>
                <div class={roles}>
                  <For each={g.roles}>
                    {(a) => (
                      <Show
                        when={editing() === a.id}
                        fallback={
                          <ExperienceRole
                            role={a}
                            timeline={many}
                            onEdit={() => setEditing(a.id)}
                            onEnd={() => end(a)}
                            onRemove={() =>
                              void remove({
                                personId: props.personId,
                                id: a.id,
                              })
                            }
                          />
                        }
                      >
                        <RoleForm
                          lockOrganization
                          initial={draftOf(a)}
                          onCancel={() => setEditing(null)}
                          onSave={(d) => saveExisting(a.id, d)}
                        />
                      </Show>
                    )}
                  </For>
                </div>
                <For each={colleaguesOf(g.roles.map((r) => r.id))}>
                  {(c) => <OverlapRow colleague={c} personId={props.personId} />}
                </For>
              </div>
            </div>
          );
        }}
      </For>
    </section>
  );
}
