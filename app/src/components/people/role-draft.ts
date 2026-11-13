// The editable shape of one role and its conversions to and from the
// stored record. Blank text clears a field on save.
import type { AffiliationKind, RoleStatus } from "~/lib/people/career-periods";
import type { Affiliation } from "~/lib/people/types";

export type RoleDraft = {
  organization: { id: string; name: string } | null;
  kind: AffiliationKind;
  status: RoleStatus;
  role: string;
  startOn: string;
  startApprox: boolean;
  endOn: string;
  endApprox: boolean;
  location: string;
  responsibilities: string;
  sourceLabel: string;
  sourceUrl: string;
};

export const emptyDraft = (kind: AffiliationKind): RoleDraft => ({
  organization: null,
  kind,
  status: kind === "employment" ? "current" : "unknown",
  role: "",
  startOn: "",
  startApprox: false,
  endOn: "",
  endApprox: false,
  location: "",
  responsibilities: "",
  sourceLabel: "",
  sourceUrl: "",
});

export const draftOf = (a: Affiliation): RoleDraft => ({
  organization: a.organization,
  kind: a.kind,
  status: a.status,
  role: a.role ?? "",
  startOn: a.startOn ?? "",
  startApprox: a.startApprox,
  endOn: a.endOn ?? "",
  endApprox: a.endApprox,
  location: a.location ?? "",
  responsibilities: a.responsibilities ?? "",
  sourceLabel: a.sourceLabel ?? "",
  sourceUrl: a.sourceUrl ?? "",
});

/** The write payload; blank text clears a field. */
export const patchOf = (d: RoleDraft) => ({
  kind: d.kind,
  status: d.status,
  role: d.role,
  startOn: d.startOn.trim() || null,
  startApprox: d.startApprox,
  endOn: d.status === "current" ? null : d.endOn.trim() || null,
  endApprox: d.status !== "current" && d.endApprox,
  location: d.location,
  responsibilities: d.responsibilities,
  sourceLabel: d.sourceLabel,
  sourceUrl: d.sourceUrl,
});
