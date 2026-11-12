import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it, vi } from "vitest";
import { todayLocal } from "~/lib/people/dates";
import {
  testDatabaseEnabled as enabled,
  testDatabaseUrl as url,
} from "~/test/database";

// Imports and merges: repeat imports find the same people, curated values
// survive, similar names never merge on their own, and a merge keeps history.

const { client: db } = vi.hoisted(() => ({
  client: { current: null as PrismaClient | null },
}));
vi.mock("~/server/db", () => ({
  get prisma() {
    return db.current;
  },
}));

const imports = await import("./import-store");
const merge = await import("./merge-store");
const people = await import("./person-store");
const memory = await import("./memory-store");

const header =
  "Id,First Name,Last Name,Email Address,Company,Position,Location";

describe.skipIf(!enabled)("people import and merge (database)", () => {
  db.current = enabled
    ? new PrismaClient({ datasources: { db: { url } } })
    : null;
  const prisma = () => db.current!;
  const tag = `i${Date.now()}`;
  const source = `test-${tag}`;

  const people500 = Array.from({ length: 500 }, (_, i) =>
    [
      `${tag}-${i}`,
      `P${i}`,
      tag,
      `p${i}.${tag}@example.com`,
      i % 2 ? `Org ${tag}` : "",
      i % 2 ? "Engineer" : "",
      "Indianapolis",
    ].join(","),
  );

  afterAll(async () => {
    const ids = (
      await prisma().person.findMany({
        where: {
          OR: [
            { displayName: { contains: tag } },
            { identities: { some: { source } } },
          ],
        },
        select: { id: true },
      })
    ).map((p) => p.id);
    await prisma().interaction.deleteMany({
      where: { participants: { some: { personId: { in: ids } } } },
    });
    await prisma().person.deleteMany({ where: { id: { in: ids } } });
    await prisma().organization.deleteMany({
      where: { name: { contains: tag } },
    });
    await prisma().peopleImport.deleteMany({ where: { source } });
    await prisma().$disconnect();
  });

  it("imports 500 rows, then re-imports without duplicates or curated loss", async () => {
    const started = Date.now();
    const content = [header, ...people500].join("\n");
    const first = await imports.previewImport({
      source,
      fileName: "a.csv",
      content,
    });
    expect(first.counts).toEqual({ create: 500 });
    const run1 = await imports.applyImport(first.id);
    expect(run1).toMatchObject({ applied: 500, failed: 0, skipped: 0 });
    console.info(
      `[people-test] 500-row preview + apply took ${Date.now() - started}ms`,
    );
    expect(
      await prisma().person.count({
        where: { displayName: { endsWith: tag } },
      }),
    ).toBe(500);
    expect(
      await prisma().organization.count({ where: { name: `Org ${tag}` } }),
    ).toBe(1);

    // A curated edit between runs, then a file that disagrees with it.
    const p0 = await prisma().person.findFirstOrThrow({
      where: { displayName: `P0 ${tag}` },
    });
    await people.updatePerson(p0.id, { location: "Carmel" });
    const second = await imports.previewImport({
      source,
      fileName: "b.csv",
      content,
    });
    expect(second.counts).toEqual({ unchanged: 499, conflict: 1 });
    const conflict = second.rows.find((r) => r.outcome === "conflict")!;
    expect(conflict.conflicts).toEqual([
      { field: "location", current: "Carmel", incoming: "Indianapolis" },
    ]);
    await imports.applyImport(second.id);
    expect(
      await prisma().person.count({
        where: { displayName: { endsWith: tag } },
      }),
    ).toBe(500);
    expect(
      (await prisma().person.findUniqueOrThrow({ where: { id: p0.id } }))
        .location,
    ).toBe("Carmel");
  }, 180_000);

  it("keeps same-name people apart and requires a choice", async () => {
    const twin = `Twin ${tag}`;
    const a = await people.createPerson({ displayName: twin });
    const b = await people.createPerson({ displayName: twin });
    // No stable key and no contact: a same-name row is only a candidate.
    const content = `Name,Company\n${twin},Acme ${tag}\n`;
    const plan = await imports.previewImport({
      source,
      fileName: "twin.csv",
      content,
    });
    const row = plan.rows[0];
    expect(row.outcome).toBe("candidates");
    expect(row.candidates.map((c) => c.id).sort()).toEqual(
      [a.person.id, b.person.id].sort(),
    );
    const skipped = await imports.applyImport(plan.id);
    expect(skipped).toMatchObject({ applied: 0, skipped: 1 });
    const chosen = await imports.applyImport(plan.id, { 1: b.person.id });
    expect(chosen.applied).toBe(1);
    const roles = await prisma().personAffiliation.findMany({
      where: { personId: { in: [a.person.id, b.person.id] } },
    });
    expect(roles.map((r) => r.personId)).toEqual([b.person.id]);
  });

  it("allows a shared contact value without merging", async () => {
    const content = `Name,Phone\nParent A ${tag},(317) 555-0142\nParent B ${tag},317-555-0142\n`;
    const plan = await imports.previewImport({
      source,
      fileName: "family.csv",
      content,
    });
    expect(plan.rows.map((r) => r.outcome)).toEqual(["create", "create"]);
    const run = await imports.applyImport(plan.id);
    // The second row re-plans after the first is written: now a candidate.
    expect(run).toMatchObject({ applied: 1, skipped: 1 });
    const again = await imports.applyImport(plan.id, { 2: "new" });
    expect(again.applied).toBe(1);
    expect(
      await prisma().personContact.count({
        where: {
          matchValue: "3175550142",
          person: { displayName: { endsWith: tag } },
        },
      }),
    ).toBe(2);
  });

  it("reports invalid rows and key conflicts, and resumes a partial apply", async () => {
    const content = `Id,Name\nk0-${tag},\nk1-${tag},Kim ${tag}\nk1-${tag},Kim Again ${tag}\nk2-${tag},Lee ${tag}\n`;
    const plan = await imports.previewImport({
      source,
      fileName: "bad.csv",
      content,
    });
    expect(plan.rows.map((r) => r.outcome)).toEqual([
      "invalid",
      "create",
      "invalid",
      "create",
    ]);
    expect(plan.rows[2].message).toMatch(/Same key as row 2/);

    // Point row 4 at a person that does not exist: it is held back, the rest apply.
    const run = await imports.applyImport(plan.id, { 4: "missing-person" });
    expect(run).toMatchObject({ applied: 1, skipped: 3 });
    const retry = await imports.applyImport(plan.id);
    expect(retry).toMatchObject({ applied: 1 });
    const kims = await prisma().person.count({
      where: { displayName: { startsWith: "Kim", endsWith: tag } },
    });
    expect(kims).toBe(1);

    // A key already tied to Kim cannot be pointed at someone else.
    const lee = await prisma().person.findFirstOrThrow({
      where: { displayName: `Lee ${tag}` },
    });
    const again = await imports.previewImport({
      source,
      fileName: "bad2.csv",
      content: `Id,Name\nk1-${tag},Kim ${tag}\n`,
    });
    const moved = await imports.getImportPlan(again.id, { 1: lee.id });
    expect(moved.rows[0]).toMatchObject({ outcome: "conflict" });
    expect(moved.rows[0].message).toMatch(/already belongs to Kim/);
  });

  it("merges a duplicate and keeps facts, encounters, and identities", async () => {
    const a = (
      await people.createPerson({
        displayName: `Jo ${tag}`,
        summary: "Keeps this",
      })
    ).person;
    const b = (
      await people.createPerson({
        displayName: `Joanna ${tag}`,
        location: "Fishers",
      })
    ).person;
    const other = (await people.createPerson({ displayName: `Pat ${tag}` }))
      .person;
    await memory.addFact({ personId: b.id, text: "Plays cello" });
    const today = todayLocal();
    // Both were in one encounter: one participant row survives, as contact.
    await memory.logInteraction({
      occurredOn: today,
      summary: "Dinner",
      participants: [
        { personId: a.id, countsAsContact: false },
        { personId: b.id },
        { personId: other.id },
      ],
    });
    await prisma().personExternalIdentity.create({
      data: { personId: b.id, source, externalKey: `jo-${tag}` },
    });

    const dupes = await merge.findDuplicates(a.id);
    expect(dupes.map((d) => d.id)).not.toContain(b.id); // different names, no shared contact

    await merge.mergePeople({ survivorId: a.id, duplicateId: b.id });
    const survivor = await people.getPersonProfile(a.id);
    expect(survivor).toMatchObject({
      displayName: `Jo ${tag}`,
      summary: "Keeps this",
      location: "Fishers",
      lastContactOn: today,
    });
    expect(survivor!.aliases).toContain(`Joanna ${tag}`);
    expect(survivor!.facts.map((f) => f.text)).toEqual(["Plays cello"]);
    expect(
      survivor!.interactions[0].participants.map((p) => p.id).sort(),
    ).toEqual([a.id, other.id].sort());
    const gone = await prisma().person.findUniqueOrThrow({
      where: { id: b.id },
    });
    expect(gone).toMatchObject({ mergedIntoId: a.id });
    expect(gone.archivedAt).not.toBeNull();
    expect(
      await prisma().personExternalIdentity.findFirst({
        where: { externalKey: `jo-${tag}` },
      }),
    ).toMatchObject({ personId: a.id });
  });
});
