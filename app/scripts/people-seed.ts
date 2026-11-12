/**
 * Seeds fictional People for trials and scale checks.
 *
 *   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/visual_notes_audit_<owner> \
 *   AUTH_SECRET=local-seed-only-secret MAGIC_PASSWORD=x OPENAI_API_KEY= \
 *   pnpm people:seed -- --count 40 [--seed 1]
 *
 * The env check needs AUTH_SECRET and MAGIC_PASSWORD; the seed never uses them.
 *
 * Refuses any database that is not a loopback visual_notes_audit_ one. Every
 * name, detail, and encounter is invented. Each run appends, so seed a fresh
 * owner when you need an exact count.
 */
import { parseArgs } from "node:util";
import { isSafeTestDb } from "~/test/database";
import { addDays, todayLocal } from "~/lib/people/dates";
import { INTERACTION_KINDS } from "~/lib/people/types";
import { prisma } from "~/server/db";
import { createPerson } from "~/server/people/person-store";
import { addFact, logInteraction } from "~/server/people/memory-store";
import { createOrganization } from "~/server/people/organization-store";
import { addAffiliation, addContact } from "~/server/people/profile-store";
import {
  addFollowup,
  setReconnectCadence,
} from "~/server/people/reconnect-store";
import { addRelationship } from "~/server/people/relationship-store";
import { seededRandom } from "~/server/notes/imported-markdown-corpus";

const { values } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== "--"),
  options: {
    count: { type: "string", default: "40" },
    seed: { type: "string", default: "1" },
  },
  strict: true,
});

if (!isSafeTestDb(process.env.DATABASE_URL)) {
  console.error(
    "[people-seed] DATABASE_URL must name a loopback visual_notes_audit_ database.",
  );
  process.exit(1);
}
const count = Number(values.count);
if (!Number.isInteger(count) || count < 1 || count > 10000) {
  console.error("[people-seed] Use --count <1..10000>.");
  process.exit(1);
}

const random = seededRandom(Number(values.seed));
const pick = <T>(items: readonly T[]) =>
  items[Math.floor(random() * items.length)];

const FIRST = [
  "Avery",
  "Blake",
  "Casey",
  "Dana",
  "Elliot",
  "Finley",
  "Gray",
  "Harper",
  "Indy",
  "Jordan",
  "Kai",
  "Logan",
  "Morgan",
  "Noel",
  "Oakley",
  "Parker",
  "Quinn",
  "Reese",
  "Sage",
  "Tatum",
  "Umi",
  "Val",
  "Wren",
  "Xen",
  "Yael",
  "Zion",
];
const LAST = [
  "Abara",
  "Brightwater",
  "Castellan",
  "Dunmore",
  "Everly",
  "Fairbanks",
  "Galloway",
  "Hollis",
  "Ingram",
  "Juniper",
  "Kettering",
  "Lindqvist",
  "Marrow",
  "Northcott",
  "Oyelaran",
  "Pemberton",
  "Quayle",
  "Rosewood",
  "Sutter",
  "Thorne",
];
const CONTEXTS = [
  "work",
  "school",
  "church",
  "neighborhood",
  "family",
  "climbing gym",
  "book club",
  "conference",
];
const LOCATIONS = [
  "Indianapolis",
  "Carmel",
  "Fishers",
  "Bloomington",
  "Chicago",
  "Remote",
];
const FACTS = [
  ["Family", "Oldest child enjoys robotics"],
  ["Family", "Has twin daughters starting kindergarten"],
  ["Interests", "Training for a spring half marathon"],
  ["Interests", "Restores old film cameras"],
  ["Food", "Vegetarian; loves Ethiopian food"],
  ["Work", "Moving into a data engineering role"],
  ["Work", "Looking for a product design mentor"],
  ["Interests", "Plays cello in a community orchestra"],
  ["Family", "Parents live in Fort Wayne"],
  ["Travel", "Planning a trip to Portugal in the fall"],
] as const;
const ENCOUNTERS = [
  "Coffee after the planning meeting",
  "Talked at the school fundraiser",
  "Quick call about the volunteer schedule",
  "Ran into each other at the climbing gym",
  "Lunch to catch up on the new job",
  "Swapped book recommendations after church",
];

const ORGS = [
  ["Lumen Robotics", "company"],
  ["Northside Elementary", "school"],
  ["Grace Fellowship", "church"],
  ["Riverbend Climbing", "gym"],
  ["Copperline Analytics", "company"],
  ["Indy Data Meetup", "community"],
] as const;
const ROLES = [
  "Engineer",
  "Designer",
  "Teacher",
  "Volunteer",
  "Director",
  "Member",
  "Product manager",
  null,
];

const today = todayLocal();
const started = Date.now();
const ids: string[] = [];
const orgIds: string[] = [];
for (const [name, kind] of ORGS) {
  const { organization } = await createOrganization({ name: `${name}`, kind });
  orgIds.push(organization.id);
}
for (let i = 0; i < count; i++) {
  const first = FIRST[i % FIRST.length];
  const last = LAST[Math.floor(i / FIRST.length) % LAST.length];
  const suffix =
    i >= FIRST.length * LAST.length
      ? ` ${Math.floor(i / (FIRST.length * LAST.length)) + 1}`
      : "";
  const contexts = [
    ...new Set(
      [pick(CONTEXTS), random() < 0.3 ? pick(CONTEXTS) : null].filter(
        (c): c is string => !!c,
      ),
    ),
  ];
  const { person } = await createPerson({
    displayName: `${first} ${last}${suffix}`,
    contexts,
    location: random() < 0.7 ? pick(LOCATIONS) : null,
    summary: random() < 0.4 ? `Met through ${contexts[0]}.` : null,
  });
  ids.push(person.id);
  if (random() < 0.6) {
    await addContact(person.id, {
      kind: "email",
      value: `${first}.${last}${suffix.trim()}@example.com`.toLowerCase(),
      label: random() < 0.5 ? "personal" : "work",
    });
  }
  if (random() < 0.3) {
    // Shared household numbers are allowed; matching only flags candidates.
    await addContact(person.id, {
      kind: "phone",
      value: `(317) 555-01${String(i % 40).padStart(2, "0")}`,
    });
  }
  const roleCount = Math.floor(random() * 3);
  for (let r = 0; r < roleCount; r++) {
    const ended = random() < 0.3;
    await addAffiliation(person.id, {
      organizationId: pick(orgIds),
      role: pick(ROLES),
      startOn:
        random() < 0.6
          ? addDays(today, -400 - Math.floor(random() * 2000))
          : null,
      endOn: ended ? addDays(today, -Math.floor(random() * 300) - 1) : null,
    });
  }
  const factCount = Math.floor(random() * 3);
  for (let f = 0; f < factCount; f++) {
    const [category, text] = pick(FACTS);
    await addFact({
      personId: person.id,
      text,
      category,
      learnedOn:
        random() < 0.5 ? addDays(today, -Math.floor(random() * 400)) : null,
    });
  }
}
// Encounters, some shared by two or three people.
for (let i = 0; i < Math.round(count * 1.5); i++) {
  const group = [
    ...new Set(
      [pick(ids), pick(ids), random() < 0.3 ? pick(ids) : null].filter(
        (id): id is string => !!id,
      ),
    ),
  ];
  await logInteraction({
    occurredOn: addDays(today, -Math.floor(random() * 700)),
    kind: pick(INTERACTION_KINDS.slice(0, 6)),
    summary: pick(ENCOUNTERS),
    participants: group.map((personId) => ({ personId })),
  });
}
// A sparse web of explicit relationships, so the network has paths.
const TYPES = [
  "friend",
  "colleague",
  "mentor",
  "neighbor",
  "sibling",
  "introduced",
];
for (let i = 1; i < ids.length; i++) {
  if (random() < 0.7) {
    const other = ids[Math.floor(random() * i)];
    await addRelationship({
      fromPersonId: ids[i],
      toPersonId: other,
      type: pick(TYPES),
      source: "seed",
    });
  }
}
// Opt a few people in to reconnect suggestions, and add explicit reasons.
for (const id of ids.filter(() => random() < 0.2)) {
  await setReconnectCadence(
    id,
    pick([30, 90, 182]),
    addDays(today, -Math.floor(random() * 300)),
  );
}
const REASONS = [
  "Ask how the new job is going",
  "Send the book you mentioned",
  "Congratulate them on the race",
  "Check in after the move",
];
for (const id of ids.filter(() => random() < 0.08)) {
  await addFollowup({
    personId: id,
    reason: pick(REASONS),
    suggestedOn: addDays(today, Math.floor(random() * 40) - 20),
  });
}
console.info(
  `[people-seed] created ${count} people in ${Date.now() - started}ms`,
);
await prisma.$disconnect();
