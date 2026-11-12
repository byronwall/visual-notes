import { action, json } from "@solidjs/router";
import { z } from "zod";
import type {
  AffiliationInput,
  AffiliationPatch,
  ContactInput,
  ContactPatch,
  OrganizationInput,
  OrganizationPatch,
  FactInput,
  FactPatch,
  InteractionInput,
  InteractionPatch,
  PersonInput,
  PersonPatch,
} from "~/lib/people/schemas";
import {
  addFact,
  logInteraction,
  updateFact,
  updateInteraction,
} from "~/server/people/memory-store";
import {
  createOrganization,
  updateOrganization,
} from "~/server/people/organization-store";
import { createPerson, updatePerson } from "~/server/people/person-store";
import {
  addAffiliation,
  addContact,
  linkNote,
  removeAffiliation,
  removeContact,
  unlinkNote,
  updateAffiliation,
  updateContact,
} from "~/server/people/profile-store";
import {
  fetchOrganization,
  fetchOrganizations,
  fetchPeople,
  fetchPeopleContexts,
  fetchPerson,
  fetchPersonCandidates,
} from "./people.queries";

const id = z.string().min(1);

// People writes are few; each refreshes every People read.
const PEOPLE_KEYS = [
  fetchPeople.key,
  fetchPerson.key,
  fetchPeopleContexts.key,
  fetchPersonCandidates.key,
  fetchOrganizations.key,
  fetchOrganization.key,
];

export const createPersonAction = action(async (input: PersonInput) => {
  "use server";
  const { person } = await createPerson(input);
  return json(person, { revalidate: PEOPLE_KEYS });
}, "people-create");

export const updatePersonAction = action(
  async (payload: { id: string; patch: PersonPatch }) => {
    "use server";
    const { person } = await updatePerson(id.parse(payload.id), payload.patch);
    return json(person, { revalidate: PEOPLE_KEYS });
  },
  "people-update",
);

export const addFactAction = action(async (input: FactInput) => {
  "use server";
  const { fact } = await addFact(input);
  return json(fact, { revalidate: PEOPLE_KEYS });
}, "people-add-fact");

export const updateFactAction = action(
  async (payload: { id: string; patch: FactPatch }) => {
    "use server";
    const fact = await updateFact(id.parse(payload.id), payload.patch);
    return json(fact, { revalidate: PEOPLE_KEYS });
  },
  "people-update-fact",
);

export const logInteractionAction = action(async (input: InteractionInput) => {
  "use server";
  const { interaction } = await logInteraction(input);
  return json(interaction, { revalidate: PEOPLE_KEYS });
}, "people-log-interaction");

export const updateInteractionAction = action(
  async (payload: { id: string; patch: InteractionPatch }) => {
    "use server";
    const interaction = await updateInteraction(
      id.parse(payload.id),
      payload.patch,
    );
    return json(interaction, { revalidate: PEOPLE_KEYS });
  },
  "people-update-interaction",
);

type Nested<T> = { personId: string; input: T };
type NestedPatch<T> = { personId: string; id: string; patch: T };

export const addContactAction = action(async (p: Nested<ContactInput>) => {
  "use server";
  const contact = await addContact(id.parse(p.personId), p.input);
  return json(contact, { revalidate: PEOPLE_KEYS });
}, "people-add-contact");

export const updateContactAction = action(
  async (p: NestedPatch<ContactPatch>) => {
    "use server";
    const contact = await updateContact(
      id.parse(p.id),
      p.patch,
      undefined,
      p.personId,
    );
    return json(contact, { revalidate: PEOPLE_KEYS });
  },
  "people-update-contact",
);

export const removeContactAction = action(
  async (p: { personId: string; id: string }) => {
    "use server";
    await removeContact(id.parse(p.id), undefined, p.personId);
    return json({ ok: true }, { revalidate: PEOPLE_KEYS });
  },
  "people-remove-contact",
);

export const addAffiliationAction = action(
  async (p: Nested<AffiliationInput>) => {
    "use server";
    const affiliation = await addAffiliation(id.parse(p.personId), p.input);
    return json(affiliation, { revalidate: PEOPLE_KEYS });
  },
  "people-add-affiliation",
);

export const updateAffiliationAction = action(
  async (p: NestedPatch<AffiliationPatch>) => {
    "use server";
    const affiliation = await updateAffiliation(
      id.parse(p.id),
      p.patch,
      undefined,
      p.personId,
    );
    return json(affiliation, { revalidate: PEOPLE_KEYS });
  },
  "people-update-affiliation",
);

export const removeAffiliationAction = action(
  async (p: { personId: string; id: string }) => {
    "use server";
    await removeAffiliation(id.parse(p.id), undefined, p.personId);
    return json({ ok: true }, { revalidate: PEOPLE_KEYS });
  },
  "people-remove-affiliation",
);

export const linkNoteAction = action(
  async (p: { personId: string; docId: string; linked: boolean }) => {
    "use server";
    const personId = id.parse(p.personId);
    const docId = id.parse(p.docId);
    if (p.linked) await linkNote(personId, docId);
    else await unlinkNote(personId, docId);
    return json({ ok: true }, { revalidate: PEOPLE_KEYS });
  },
  "people-link-note",
);

export const createOrganizationAction = action(
  async (input: OrganizationInput) => {
    "use server";
    const { organization } = await createOrganization(input);
    return json(organization, { revalidate: PEOPLE_KEYS });
  },
  "people-create-organization",
);

export const updateOrganizationAction = action(
  async (p: { id: string; patch: OrganizationPatch }) => {
    "use server";
    const { organization } = await updateOrganization(id.parse(p.id), p.patch);
    return json(organization, { revalidate: PEOPLE_KEYS });
  },
  "people-update-organization",
);
