import { query } from "@solidjs/router";
import type { PeopleListInput } from "~/lib/people/schemas";
import {
  findPeopleByName,
  getPersonProfile,
  listPeople,
  listPeopleContexts,
} from "~/server/people/person-store";

export const fetchPeople = query(async (input: PeopleListInput) => {
  "use server";
  return listPeople(input ?? {});
}, "people-list");

export const fetchPerson = query(async (id: string) => {
  "use server";
  return getPersonProfile(id);
}, "people-person");

export const fetchPeopleContexts = query(async () => {
  "use server";
  return listPeopleContexts();
}, "people-contexts");

/** Name and alias matches for the capture person picker. */
export const fetchPersonCandidates = query(async (name: string) => {
  "use server";
  return findPeopleByName(name ?? "", 8);
}, "people-candidates");
