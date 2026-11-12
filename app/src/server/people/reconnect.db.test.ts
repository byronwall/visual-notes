import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it, vi } from "vitest";
import {
  testDatabaseEnabled as enabled,
  testDatabaseUrl as url,
} from "~/test/database";

// Reconnect rules on a fixed clock: opt-in cadence, snooze boundaries,
// dismissal that sticks, contact that moves the due day, archive, and merge.

const { client: db } = vi.hoisted(() => ({
  client: { current: null as PrismaClient | null },
}));
vi.mock("~/server/db", () => ({
  get prisma() {
    return db.current;
  },
}));

const reconnect = await import("./reconnect-store");
const people = await import("./person-store");
const memory = await import("./memory-store");
const merge = await import("./merge-store");

describe.skipIf(!enabled)("people reconnect (database)", () => {
  db.current = enabled
    ? new PrismaClient({ datasources: { db: { url } } })
    : null;
  const tag = `r${Date.now()}`;
  const ids: string[] = [];
  const person = async (name: string) => {
    const { person } = await people.createPerson({
      displayName: `${name} ${tag}`,
    });
    ids.push(person.id);
    return person;
  };
  const due = async (personId: string, today: string) =>
    (await reconnect.listFollowups({ today, personId })).map((f) => f.key);

  afterAll(async () => {
    await db.current?.interaction.deleteMany({
      where: { participants: { some: { personId: { in: ids } } } },
    });
    await db.current?.person.deleteMany({ where: { id: { in: ids } } });
    await db.current?.$disconnect();
  });

  it("stays quiet without opt-in and treats no contact as unknown, not overdue", async () => {
    const quiet = await person("Quiet");
    expect(await due(quiet.id, "2026-06-01")).toEqual([]);

    const p = await person("Opted");
    await reconnect.setReconnectCadence(p.id, 30, "2026-01-01");
    expect(await due(p.id, "2026-01-30")).toEqual([]);
    expect(await due(p.id, "2026-01-31")).toEqual([
      reconnect.elapsedKey(p.id, "2026-01-31"),
    ]);
    // Listing again gives the same stable key and stores nothing.
    expect(await due(p.id, "2026-01-31")).toEqual([
      reconnect.elapsedKey(p.id, "2026-01-31"),
    ]);
    expect(
      await db.current!.peopleReconnect.count({ where: { personId: p.id } }),
    ).toBe(0);
    // A fact is not contact: the due day stays.
    await memory.addFact({ personId: p.id, text: "Moved to Denver" });
    expect(await due(p.id, "2026-01-31")).toHaveLength(1);
  });

  it("snoozes to a day, dismisses for good, and moves with new contact", async () => {
    const p = await person("Snoozy");
    await reconnect.setReconnectCadence(p.id, 30, "2026-01-01");
    const key = reconnect.elapsedKey(p.id, "2026-01-31");
    await reconnect.updateFollowup({
      key,
      action: "snooze",
      snoozedUntil: "2026-02-10",
      today: "2026-02-01",
    });
    expect(await due(p.id, "2026-02-09")).toEqual([]);
    expect(await due(p.id, "2026-02-10")).toEqual([key]);

    await reconnect.updateFollowup({
      key,
      action: "dismiss",
      today: "2026-02-10",
    });
    expect(await due(p.id, "2026-03-01")).toEqual([]);

    // New contact starts a new cycle with a new key.
    await memory.logInteraction({
      occurredOn: "2026-02-12",
      summary: "Coffee",
      participants: [{ personId: p.id }],
    });
    expect(await due(p.id, "2026-03-13")).toEqual([]);
    expect(await due(p.id, "2026-03-14")).toEqual([
      reconnect.elapsedKey(p.id, "2026-03-14"),
    ]);
    expect(
      await reconnect.listFollowups({
        today: "2026-03-14",
        personId: p.id,
        include: ["dismissed"],
      }),
    ).toEqual([]);
  });

  it("resolves an older snoozed suggestion once contact moves the due day", async () => {
    const p = await person("Mover");
    await reconnect.setReconnectCadence(p.id, 30, "2026-01-01");
    const key = reconnect.elapsedKey(p.id, "2026-01-31");
    await reconnect.updateFollowup({
      key,
      action: "snooze",
      snoozedUntil: "2026-02-20",
      today: "2026-02-01",
    });
    await memory.logInteraction({
      occurredOn: "2026-02-05",
      summary: "Ran into them",
      participants: [{ personId: p.id }],
    });
    await reconnect.listFollowups({ today: "2026-02-21", personId: p.id });
    const row = await db.current!.peopleReconnect.findUniqueOrThrow({
      where: { key },
    });
    expect(row.status).toBe("resolved");
    // Resolving never counts as contact.
    expect((await people.getPersonProfile(p.id))!.lastContactOn).toBe(
      "2026-02-05",
    );
  });

  it("keeps a dismissed contextual prompt dismissed and skips archived people", async () => {
    const p = await person("Context");
    const fact = await memory.addFact({
      personId: p.id,
      text: "Starting a new job in March",
    });
    const { key } = await reconnect.addFollowup({
      personId: p.id,
      reason: "Ask how the new job is going",
      suggestedOn: "2026-04-01",
      sourceFactId: fact.fact.id,
    });
    const listed = await reconnect.listFollowups({
      today: "2026-04-01",
      personId: p.id,
    });
    expect(listed[0]).toMatchObject({
      key,
      kind: "contextual",
      source: { text: "Starting a new job in March" },
    });
    await reconnect.updateFollowup({
      key,
      action: "dismiss",
      today: "2026-04-01",
    });
    expect(await due(p.id, "2026-04-02")).toEqual([]);

    const gone = await person("Archived");
    await reconnect.setReconnectCadence(gone.id, 30, "2026-01-01");
    await people.updatePerson(gone.id, { archived: true });
    expect(await due(gone.id, "2026-06-01")).toEqual([]);
  });

  it("moves prompts to the survivor on merge", async () => {
    const a = await person("Keep");
    const b = await person("Drop");
    const { key } = await reconnect.addFollowup({
      personId: b.id,
      reason: "Send the book",
      suggestedOn: "2026-05-01",
    });
    await merge.mergePeople({ survivorId: a.id, duplicateId: b.id });
    expect(await due(a.id, "2026-05-01")).toEqual([key]);
  });
});
