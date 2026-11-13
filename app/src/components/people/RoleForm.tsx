import { useAction } from "@solidjs/router";
import { Show, createSignal, untrack } from "solid-js";
import { createStore } from "solid-js/store";
import { css } from "styled-system/css";
import { HStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { SimpleSelect } from "~/components/ui/simple-select";
import {
  ROLE_STATUS_LABELS,
  isPartialDate,
  periodProblem,
  type AffiliationKind,
  type RoleStatus,
} from "~/lib/people/career-periods";
import { createOrganizationAction } from "~/services/people/people.actions";
import { fetchOrganizations } from "~/services/people/people.queries";
import { saveErrorText } from "./capture-state";
import type { RoleDraft } from "./role-draft";
import { errorText, inlineForm, rowMeta } from "./profile-section";
import { SearchPicker } from "./SearchPicker";

const STATUS_ITEMS = (Object.keys(ROLE_STATUS_LABELS) as RoleStatus[]).map(
  (value) => ({ value, label: ROLE_STATUS_LABELS[value] }),
);
const KIND_ITEMS = [
  { value: "employment", label: "Job" },
  { value: "membership", label: "Membership" },
];

const dateRow = css({
  display: "grid",
  gridTemplateColumns: "2.5rem minmax(0, 1fr) auto",
  alignItems: "center",
  gap: "2",
});
const approx = css({
  display: "flex",
  alignItems: "center",
  gap: "1",
  fontSize: "xs",
  color: "fg.muted",
  whiteSpace: "nowrap",
});

const searchOrganizations = async (q: string) =>
  (await fetchOrganizations({ search: q })).map((o) => ({
    id: o.id,
    label: o.name,
    meta: o.kind,
  }));

function DateField(props: {
  label: string;
  value: string;
  approx: boolean;
  onValue: (v: string) => void;
  onApprox: (v: boolean) => void;
}) {
  return (
    <div class={dateRow}>
      <span class={approx}>{props.label}</span>
      <Input
        size="sm"
        aria-label={props.label}
        placeholder="2017, 2017-06, or 2017-06-12"
        value={props.value}
        onInput={(e) => props.onValue(e.currentTarget.value)}
      />
      <label class={approx}>
        <input
          type="checkbox"
          checked={props.approx}
          onChange={(e) => props.onApprox(e.currentTarget.checked)}
        />
        About
      </label>
    </div>
  );
}

/** Add or correct one role, with dates only as precise as the source. */
export function RoleForm(props: {
  initial: RoleDraft;
  lockOrganization: boolean;
  onSave: (d: RoleDraft) => Promise<void>;
  onCancel: () => void;
}) {
  const [d, setD] = createStore(untrack(() => ({ ...props.initial })));
  const [busy, setBusy] = createSignal(false);
  const [message, setMessage] = createSignal("");
  const createOrg = useAction(createOrganizationAction);
  const job = () => d.kind === "employment";

  // One retry key per typed name, so a retry cannot create a second copy.
  const createKeys = new Map<string, string>();
  const createAndPick = async (name: string) => {
    const requestKey = createKeys.get(name) ?? crypto.randomUUID();
    createKeys.set(name, requestKey);
    setBusy(true);
    try {
      const org = await createOrg({
        name,
        requestKey,
        kind: job() ? "company" : null,
      });
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
    for (const v of [d.startOn, d.endOn].map((x) => x.trim()))
      if (v && !isPartialDate(v))
        return setMessage(`Use YYYY, YYYY-MM, or YYYY-MM-DD, not "${v}".`);
    const problem = periodProblem({
      status: d.status,
      startOn: d.startOn.trim() || null,
      endOn: d.status === "current" ? null : d.endOn.trim() || null,
    });
    if (problem) return setMessage(problem);
    setBusy(true);
    try {
      await props.onSave({ ...d });
    } catch (err) {
      console.warn("[people] role save failed", err);
      setMessage(saveErrorText(err, "Could not save. Try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      class={inlineForm}
      data-role-form
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
          placeholder={job() ? "Company" : "Organization"}
          autofocus
          search={searchOrganizations}
          onPick={(o) => setD("organization", { id: o.id, name: o.label })}
          onCreate={(name) => void createAndPick(name)}
        />
      </Show>
      <HStack gap="2">
        <SimpleSelect
          items={KIND_ITEMS}
          value={d.kind}
          onChange={(v) => setD("kind", (v || "employment") as AffiliationKind)}
          size="sm"
          skipPortal={false}
        />
        <SimpleSelect
          items={STATUS_ITEMS}
          value={d.status}
          onChange={(v) => setD("status", (v || "unknown") as RoleStatus)}
          size="sm"
          skipPortal={false}
        />
      </HStack>
      <Input
        size="sm"
        aria-label="Role"
        placeholder={job() ? "Title" : "Role (optional)"}
        value={d.role}
        onInput={(e) => setD("role", e.currentTarget.value)}
      />
      <DateField
        label="Start"
        value={d.startOn}
        approx={d.startApprox}
        onValue={(v) => setD("startOn", v)}
        onApprox={(v) => setD("startApprox", v)}
      />
      <Show when={d.status !== "current"}>
        <DateField
          label="End"
          value={d.endOn}
          approx={d.endApprox}
          onValue={(v) => setD("endOn", v)}
          onApprox={(v) => setD("endApprox", v)}
        />
      </Show>
      <Show when={job()}>
        <Input
          size="sm"
          aria-label="Location"
          placeholder="Location (optional)"
          value={d.location}
          onInput={(e) => setD("location", e.currentTarget.value)}
        />
        <Input
          size="sm"
          aria-label="Responsibilities"
          placeholder="What they did (optional)"
          value={d.responsibilities}
          onInput={(e) => setD("responsibilities", e.currentTarget.value)}
        />
      </Show>
      <HStack gap="2">
        <Input
          size="sm"
          aria-label="Source"
          placeholder="Source (optional): LinkedIn, they told me"
          value={d.sourceLabel}
          onInput={(e) => setD("sourceLabel", e.currentTarget.value)}
        />
        <Input
          size="sm"
          aria-label="Source link"
          placeholder="https://…"
          value={d.sourceUrl}
          onInput={(e) => setD("sourceUrl", e.currentTarget.value)}
        />
      </HStack>
      <span class={rowMeta}>
        Dates are optional. Enter only what you know: a year or month is fine.
        Use Ended with no end date when you know it ended but not when.
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
