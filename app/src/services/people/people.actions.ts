import { action, json } from "@solidjs/router";
import { z } from "zod";
import type {
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
import { createPerson, updatePerson } from "~/server/people/person-store";
import {
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
