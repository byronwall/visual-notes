import { A, useAction } from "@solidjs/router";
import { For, Show, createSignal } from "solid-js";
import { Button } from "~/components/ui/button";
import { formatPeriod } from "~/lib/people/career-periods";
import type { Affiliation } from "~/lib/people/types";
import {
  addAffiliationAction,
  removeAffiliationAction,
  updateAffiliationAction,
} from "~/services/people/people.actions";
import {
  ProfileSection,
  emptyText,
  rowActions,
  rowMain,
  rowMeta,
  sectionRow,
} from "./profile-section";
import {
  RoleForm,
  draftOf,
  emptyDraft,
  patchOf,
  type RoleDraft,
} from "./RoleForm";

const statusText = (a: Affiliation) =>
  a.status === "current"
    ? "Current"
    : a.status === "ended"
      ? "Past"
      : "Status unknown";

/** Schools, churches, teams, and other memberships. Jobs live in Experience. */
export function AffiliationsSection(props: {
  personId: string;
  affiliations: Affiliation[];
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

  return (
    <ProfileSection title="Organizations" onAdd={() => setEditing("new")}>
      <Show when={!props.affiliations.length && editing() !== "new"}>
        <span class={emptyText}>No memberships.</span>
      </Show>
      <For each={props.affiliations}>
        {(a) => (
          <Show
            when={editing() === a.id}
            fallback={
              <div class={sectionRow} data-affiliation={a.organization.name}>
                <div class={rowMain}>
                  <A href={`/people/organizations/${a.organization.id}`}>
                    {a.organization.name}
                  </A>
                  <Show when={a.role}>
                    <span>{` · ${a.role}`}</span>
                  </Show>
                  <div class={rowMeta}>
                    {[
                      statusText(a),
                      a.startOn || a.endOn ? formatPeriod(a) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <div class={rowActions} data-row-actions>
                  <Button
                    size="xs"
                    variant="plain"
                    onClick={() => setEditing(a.id)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="xs"
                    variant="plain"
                    title="Remove a wrong association. To record that it ended, edit its status."
                    onClick={() =>
                      void remove({ personId: props.personId, id: a.id })
                    }
                  >
                    Remove
                  </Button>
                </div>
              </div>
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
      <Show when={editing() === "new"}>
        <RoleForm
          lockOrganization={false}
          initial={emptyDraft("membership")}
          onCancel={() => setEditing(null)}
          onSave={saveNew}
        />
      </Show>
    </ProfileSection>
  );
}
