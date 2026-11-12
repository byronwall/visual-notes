import { A, useAction } from "@solidjs/router";
import { For, Show, createSignal, untrack } from "solid-js";
import { createStore } from "solid-js/store";
import { HStack } from "styled-system/jsx";
import { DateInput } from "~/components/DateInput";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { formatDay, todayLocal } from "~/lib/people/dates";
import type { Affiliation } from "~/lib/people/types";
import {
  addAffiliationAction,
  createOrganizationAction,
  removeAffiliationAction,
  updateAffiliationAction,
} from "~/services/people/people.actions";
import { fetchOrganizations } from "~/services/people/people.queries";
import { saveErrorText } from "./capture-state";
import {
  ProfileSection,
  emptyText,
  errorText,
  inlineForm,
  rowActions,
  rowMain,
  rowMeta,
  sectionRow,
} from "./profile-section";
import { SearchPicker } from "./SearchPicker";

type Draft = {
  organization: { id: string; name: string } | null;
  role: string;
  startOn: string;
  endOn: string;
};

const searchOrganizations = async (q: string) =>
  (await fetchOrganizations({ search: q })).map((o) => ({
    id: o.id,
    label: o.name,
    meta: o.kind,
  }));

const span = (a: { startOn: string | null; endOn: string | null }) => {
  if (!a.startOn && !a.endOn) return null;
  const from = a.startOn ? formatDay(a.startOn) : "?";
  const to = a.endOn ? formatDay(a.endOn) : "now";
  return `${from} – ${to}`;
};

function AffiliationForm(props: {
  initial: Draft;
  lockOrganization: boolean;
  onSave: (d: Draft) => Promise<void>;
  onCancel: () => void;
}) {
  const [d, setD] = createStore(untrack(() => ({ ...props.initial })));
  const [busy, setBusy] = createSignal(false);
  const [message, setMessage] = createSignal("");
  const createOrg = useAction(createOrganizationAction);

  // One retry key per typed name, so a retry cannot create a second copy.
  const createKeys = new Map<string, string>();
  const createAndPick = async (name: string) => {
    const requestKey = createKeys.get(name) ?? crypto.randomUUID();
    createKeys.set(name, requestKey);
    // Save stays busy until the new organization exists.
    setBusy(true);
    try {
      const org = await createOrg({ name, requestKey });
      setD("organization", { id: org.id, name: org.name });
    } catch (err) {
      console.warn("[people] organization create failed", err);
      setMessage(`Could not create ${name}. Try again.`);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (busy()) return;
    if (!d.organization) return setMessage("Pick an organization.");
    setBusy(true);
    try {
      await props.onSave({ ...d });
    } catch (err) {
      console.warn("[people] affiliation save failed", err);
      setMessage(saveErrorText(err, "Could not save. Try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      class={inlineForm}
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <Show
        when={!d.organization}
        fallback={
          <HStack gap="2" fontSize="sm">
            <strong>{d.organization!.name}</strong>
            <Show when={!props.lockOrganization}>
              <Button
                size="xs"
                variant="plain"
                onClick={() => setD("organization", null)}
              >
                Change
              </Button>
            </Show>
          </HStack>
        }
      >
        <SearchPicker
          placeholder="Organization"
          autofocus
          search={searchOrganizations}
          onPick={(o) => setD("organization", { id: o.id, name: o.label })}
          onCreate={(name) => void createAndPick(name)}
        />
      </Show>
      <Input
        size="sm"
        aria-label="Role"
        placeholder="Role (optional)"
        value={d.role}
        onInput={(e) => setD("role", e.currentTarget.value)}
      />
      <HStack gap="2">
        <DateInput
          size="sm"
          aria-label="Started"
          max={todayLocal()}
          value={d.startOn}
          onChange={(v) => setD("startOn", v ?? "")}
        />
        <DateInput
          size="sm"
          aria-label="Ended"
          value={d.endOn}
          onChange={(v) => setD("endOn", v ?? "")}
        />
      </HStack>
      <span class={rowMeta}>
        Start and end are optional. Leave end empty for a current role.
      </span>
      <Show when={message()}>
        <span class={errorText} role="alert">
          {message()}
        </span>
      </Show>
      <HStack gap="2">
        <Button size="xs" type="submit" loading={busy()}>
          Save
        </Button>
        <Button size="xs" variant="plain" onClick={props.onCancel}>
          Cancel
        </Button>
      </HStack>
    </form>
  );
}

/** Roles at organizations, current first. Ending a role keeps it as history. */
export function AffiliationsSection(props: {
  personId: string;
  affiliations: Affiliation[];
}) {
  const [editing, setEditing] = createSignal<string | "new" | null>(null);
  const add = useAction(addAffiliationAction);
  const update = useAction(updateAffiliationAction);
  const remove = useAction(removeAffiliationAction);
  const today = todayLocal();
  const isPast = (a: Affiliation) => a.endOn != null && a.endOn < today;
  const dates = (d: Draft) => ({
    role: d.role,
    startOn: d.startOn || null,
    endOn: d.endOn || null,
  });
  const saveExisting = async (id: string, d: Draft) => {
    await update({ personId: props.personId, id, patch: dates(d) });
    setEditing(null);
  };
  const saveNew = async (d: Draft) => {
    await add({
      personId: props.personId,
      input: { organizationId: d.organization!.id, ...dates(d) },
    });
    setEditing(null);
  };

  return (
    <ProfileSection title="Organizations" onAdd={() => setEditing("new")}>
      <Show when={!props.affiliations.length && editing() !== "new"}>
        <span class={emptyText}>No organizations.</span>
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
                    {[isPast(a) ? "Past" : null, span(a)]
                      .filter(Boolean)
                      .join(" · ") || "Current"}
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
                    title="Remove a wrong association. To record that a role ended, edit its end day."
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
            <AffiliationForm
              lockOrganization
              initial={{
                organization: a.organization,
                role: a.role ?? "",
                startOn: a.startOn ?? "",
                endOn: a.endOn ?? "",
              }}
              onCancel={() => setEditing(null)}
              onSave={(d) => saveExisting(a.id, d)}
            />
          </Show>
        )}
      </For>
      <Show when={editing() === "new"}>
        <AffiliationForm
          lockOrganization={false}
          initial={{ organization: null, role: "", startOn: "", endOn: "" }}
          onCancel={() => setEditing(null)}
          onSave={saveNew}
        />
      </Show>
    </ProfileSection>
  );
}
