import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it, vi } from "vitest";
import {
  testDatabaseEnabled as enabled,
  testDatabaseUrl as url,
} from "~/test/database";

// Relationships and introduction paths: explicit edges only, directed labels,
// shared employers as leads rather than paths, archived people skipped.

const { client: db } = vi.hoisted(() => ({
  client: { current: null as PrismaClient | null },
}));
vi.mock("~/server/db", () => ({
  get prisma() {
    return db.current;
  },
}));

const rel = await import("./relationship-store");
const people = await import("./person-store");
const orgs = await import("./organization-store");
const profile = await import("./profile-store");
const merge = await import("./merge-store");

describe.skipIf(!enabled)("people network (database)", () => {
  db.current = enabled
    ? new PrismaClient({ datasources: { db: { url } } })
    : null;
  const tag = `n${Date.now()}`;
  const ids: string[] = [];
  const orgIds: string[] = [];
  const person = async (name: string) => {
    const { person } = await people.createPerson({
      displayName: `${name} ${tag}`,
    });
    ids.push(person.id);
    return person.id;
  };

  afterAll(async () => {
    await db.current?.person.deleteMany({ where: { id: { in: ids } } });
    await db.current?.organization.deleteMany({
      where: { id: { in: orgIds } },
    });
    await db.current?.$disconnect();
  });

  it("finds a short path and labels directed edges from each side", async () => {
    const me = await person("Me");
    const alex = await person("Alex");
    const jordan = await person("Jordan");
    const sam = await person("Sam");
    await rel.addRelationship({
      fromPersonId: me,
      toPersonId: alex,
      type: "friend",
      source: "college",
    });
    await rel.addRelationship({
      fromPersonId: alex,
      toPersonId: jordan,
      type: "mentor",
    });
    // A longer route and a cycle must not win over the short one.
    await rel.addRelationship({
      fromPersonId: me,
      toPersonId: sam,
      type: "colleague",
    });
    await rel.addRelationship({
      fromPersonId: sam,
      toPersonId: alex,
      type: "knows",
    });

    const result = await rel.findIntroductionPaths(me, jordan);
    expect(result.paths).toHaveLength(1);
    expect(
      result.paths[0].map((s) => [s.from.id, s.relationship.label, s.to.id]),
    ).toEqual([
      [me, "Friend", alex],
      [alex, "Mentor of", jordan],
    ]);
    expect(result.paths[0][0].relationship.source).toBe("college");

    const fromJordan = await rel.listRelationships(jordan);
    expect(fromJordan.map((r) => r.label)).toEqual(["Mentee of"]);
  });

  it("treats a shared employer as a lead, never as a path", async () => {
    const me = await person("Solo");
    const friend = await person("Friend");
    const target = await person("Target");
    const acme = (await orgs.createOrganization({ name: `Acme ${tag}` }))
      .organization;
    orgIds.push(acme.id);
    await rel.addRelationship({
      fromPersonId: me,
      toPersonId: friend,
      type: "friend",
    });
    await profile.addAffiliation(friend, { organizationId: acme.id });
    await profile.addAffiliation(target, { organizationId: acme.id });

    const result = await rel.findIntroductionPaths(me, target);
    expect(result.paths).toEqual([]);
    expect(result.leads).toHaveLength(1);
    expect(result.leads[0]).toMatchObject({
      person: { id: friend },
      organization: { id: acme.id },
    });
  });

  it("skips archived people and refuses self-edges and unknown types", async () => {
    const a = await person("Start");
    const mid = await person("Middle");
    const end = await person("End");
    await rel.addRelationship({
      fromPersonId: a,
      toPersonId: mid,
      type: "friend",
    });
    await rel.addRelationship({
      fromPersonId: mid,
      toPersonId: end,
      type: "friend",
    });
    expect((await rel.findIntroductionPaths(a, end)).paths).toHaveLength(1);
    await people.updatePerson(mid, { archived: true });
    expect((await rel.findIntroductionPaths(a, end)).paths).toEqual([]);

    await expect(
      rel.addRelationship({ fromPersonId: a, toPersonId: a, type: "friend" }),
    ).rejects.toThrow(/themself/);
    await expect(
      rel.addRelationship({
        fromPersonId: a,
        toPersonId: end,
        type: "frenemy",
      }),
    ).rejects.toThrow(/Invalid relationship type/);
  });

  it("keeps one symmetric edge per pair and type", async () => {
    const a = await person("Pair A");
    const b = await person("Pair B");
    const first = await rel.addRelationship({
      fromPersonId: a,
      toPersonId: b,
      type: "sibling",
    });
    const again = await rel.addRelationship({
      fromPersonId: b,
      toPersonId: a,
      type: "sibling",
    });
    expect(again.id).toBe(first.id);
    await rel.addRelationship({
      fromPersonId: a,
      toPersonId: b,
      type: "colleague",
    });
    expect(await rel.listRelationships(a)).toHaveLength(2);
  });

  it("keeps an active edge and the self mark through a merge", async () => {
    const keep = await person("Survivor");
    const dup = await person("Duplicate");
    const c = await person("Common");
    const old = await rel.addRelationship({
      fromPersonId: keep,
      toPersonId: c,
      type: "friend",
    });
    await rel.updateRelationship(old.id, { archived: true });
    await rel.addRelationship({
      fromPersonId: dup,
      toPersonId: c,
      type: "friend",
    });
    await rel.setSelf(dup);

    await merge.mergePeople({ survivorId: keep, duplicateId: dup });
    const edges = await rel.listRelationships(keep);
    expect(edges.map((e) => [e.label, e.other.id, e.archived])).toEqual([
      ["Friend", c, false],
    ]);
    expect((await rel.getSelf())?.id).toBe(keep);
    await rel.setSelf(null);
  });

  it("moves edges on merge and drops the edge between the merged pair", async () => {
    const keep = await person("Keep");
    const drop = await person("Drop");
    const other = await person("Other");
    await rel.addRelationship({
      fromPersonId: keep,
      toPersonId: drop,
      type: "knows",
    });
    await rel.addRelationship({
      fromPersonId: drop,
      toPersonId: other,
      type: "mentor",
    });
    await merge.mergePeople({ survivorId: keep, duplicateId: drop });
    const edges = await rel.listRelationships(keep);
    expect(edges.map((e) => [e.label, e.other.id])).toEqual([
      ["Mentor of", other],
    ]);
  });
});
