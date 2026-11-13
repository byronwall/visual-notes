import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it, vi } from "vitest";
import { addDays, todayLocal } from "~/lib/people/dates";
import {
  testDatabaseEnabled as enabled,
  testDatabaseUrl as url,
} from "~/test/database";

// Profiles across contexts: identity is never inferred from names, shared
// contact values, or shared organizations.

const { client: db } = vi.hoisted(() => ({
  client: { current: null as PrismaClient | null },
}));
vi.mock("~/server/db", () => ({
  get prisma() {
    return db.current;
  },
}));

const people = await import("./person-store");
const profile = await import("./profile-store");
const orgs = await import("./organization-store");

describe.skipIf(!enabled)("people profiles (database)", () => {
  db.current = enabled
    ? new PrismaClient({ datasources: { db: { url } } })
    : null;
  const tag = `p${Date.now()}`;
  const personIds: string[] = [];
  const orgIds: string[] = [];
  const today = todayLocal();

  const person = async (name: string) => {
    const { person } = await people.createPerson({ displayName: name });
    personIds.push(person.id);
    return person;
  };
  const org = async (name: string) => {
    const { organization } = await orgs.createOrganization({ name });
    orgIds.push(organization.id);
    return organization;
  };

  afterAll(async () => {
    await db.current?.person.deleteMany({ where: { id: { in: personIds } } });
    await db.current?.organization.deleteMany({
      where: { id: { in: orgIds } },
    });
    await db.current?.$disconnect();
  });

  it("allows same-name people and shared contact values", async () => {
    const a = await person(`Sam Rivera ${tag}`);
    const b = await person(`Sam Rivera ${tag}`);
    expect(a.id).not.toBe(b.id);
    await profile.addContact(a.id, { kind: "phone", value: "(317) 555-0199" });
    await profile.addContact(b.id, { kind: "phone", value: "317.555.0199" });
    const rows = await db.current!.personContact.findMany({
      where: { personId: { in: [a.id, b.id] } },
    });
    expect(rows.map((r) => r.value).sort()).toEqual([
      "(317) 555-0199",
      "317.555.0199",
    ]);
    expect(new Set(rows.map((r) => r.matchValue)).size).toBe(1);

    // Search by the contact finds both, and says why.
    const { people: hits } = await people.listPeople({ search: "555-0199" });
    const mine = hits.filter((h) => h.displayName.endsWith(tag));
    expect(mine).toHaveLength(2);
  });

  it("keeps several affiliations, current and past, without inferring acquaintance", async () => {
    const acme = await org(`Acme ${tag}`);
    const school = await org(`Northside ${tag}`);
    const a = await person(`Jamie ${tag}`);
    const b = await person(`Kendall ${tag}`);
    await profile.addAffiliation(a.id, {
      organizationId: acme.id,
      role: "Engineer",
      startOn: addDays(today, -800),
      endOn: addDays(today, -10),
    });
    await profile.addAffiliation(a.id, {
      organizationId: school.id,
      kind: "membership",
      status: "current",
      role: "Parent",
    });
    await profile.addAffiliation(b.id, {
      organizationId: acme.id,
      role: "Designer",
      status: "current",
    });

    const pa = await people.getPersonProfile(a.id);
    // Newest start first; the undated membership sorts last.
    expect(pa!.affiliations.map((x) => x.organization.name)).toEqual([
      `Acme ${tag}`,
      `Northside ${tag}`,
    ]);
    // An end day makes the role ended without a stated status.
    expect(pa!.affiliations[0].status).toBe("ended");
    expect(pa!.currentRole).toBe(`Parent, Northside ${tag}`);

    const detail = await orgs.getOrganization(acme.id);
    expect(detail!.currentMembers).toBe(1);
    expect(detail!.pastMembers).toBe(1);

    // Counts are people, not roles: a second current role and an old role
    // for Kendall still make one current member and no new past member.
    await profile.addAffiliation(b.id, {
      organizationId: acme.id,
      role: "Lead",
      status: "current",
    });
    await profile.addAffiliation(b.id, {
      organizationId: acme.id,
      role: "Intern",
      endOn: addDays(today, -400),
    });
    const recount = await orgs.getOrganization(acme.id);
    expect([recount!.currentMembers, recount!.pastMembers]).toEqual([1, 1]);

    // An undated export listing is neither current nor past work.
    const c = await person(`Listed ${tag}`);
    await profile.addAffiliation(c.id, { organizationId: acme.id, role: "PM" });
    const listed = await people.getPersonProfile(c.id);
    expect(listed!.affiliations[0].status).toBe("unknown");
    expect(listed!.currentRole).toBeNull();
    const withListing = await orgs.getOrganization(acme.id);
    expect(withListing!.currentMembers).toBe(1);
    expect(withListing!.unknownMembers).toBe(1);

    // Ending a role keeps it, with no invented end day, and leaves contact alone.
    const ended = await profile.updateAffiliation(listed!.affiliations[0].id, {
      status: "ended",
      startOn: "2019-03",
    });
    expect([ended.status, ended.startOn, ended.endOn]).toEqual([
      "ended",
      "2019-03",
      null,
    ]);
    expect((await people.getPersonProfile(c.id))!.lastContactOn).toBeNull();

    // The organization filter lists both; nothing links the two people.
    const { people: members } = await people.listPeople({
      organizationId: acme.id,
    });
    expect(members.map((m) => m.id).sort()).toEqual([a.id, b.id, c.id].sort());
    expect(
      await db.current!.interactionParticipant.count({
        where: { personId: { in: [a.id, b.id] } },
      }),
    ).toBe(0);

    await expect(
      profile.addAffiliation(a.id, {
        organizationId: acme.id,
        startOn: today,
        endOn: addDays(today, -1),
      }),
    ).rejects.toThrow(/cannot end before/);
  });

  it("filters by last-contact window", async () => {
    const memory = await import("./memory-store");
    const recent = await person(`Recent ${tag}`);
    const old = await person(`Old ${tag}`);
    const never = await person(`Never ${tag}`);
    await memory.logInteraction({
      occurredOn: addDays(today, -5),
      summary: "Hi",
      participants: [{ personId: recent.id }],
    });
    await memory.logInteraction({
      occurredOn: addDays(today, -500),
      summary: "Hi",
      participants: [{ personId: old.id }],
    });
    const ids = async (contact: "30" | "over365" | "none") =>
      (
        await people.listPeople({ search: tag, contact, limit: 200 })
      ).people.map((p) => p.id);
    expect(await ids("30")).toContain(recent.id);
    expect(await ids("30")).not.toContain(old.id);
    expect(await ids("over365")).toEqual([old.id]);
    expect(await ids("none")).toContain(never.id);
    expect(await ids("none")).not.toContain(recent.id);
    await db.current!.interaction.deleteMany({
      where: {
        participants: { some: { personId: { in: [recent.id, old.id] } } },
      },
    });
  });

  it("refuses a nested edit aimed at another person's record", async () => {
    const a = await person(`Owner ${tag}`);
    const b = await person(`Other ${tag}`);
    const contact = await profile.addContact(a.id, {
      kind: "email",
      value: "x@example.com",
    });
    await expect(
      profile.updateContact(
        contact.id,
        { value: "y@example.com" },
        undefined,
        b.id,
      ),
    ).rejects.toThrow(/not found/);
  });
});
