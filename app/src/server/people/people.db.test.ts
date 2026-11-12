import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it, vi } from "vitest";
import { addDays, todayLocal } from "~/lib/people/dates";
import {
  testDatabaseEnabled as enabled,
  testDatabaseUrl as url,
} from "~/test/database";

// The People rules where they live: a real store against a disposable
// Postgres. Knowledge (facts) and contact (encounters) must stay distinct.

const { client: db } = vi.hoisted(() => ({
  client: { current: null as PrismaClient | null },
}));
vi.mock("~/server/db", () => ({
  get prisma() {
    return db.current;
  },
}));

const people = await import("./person-store");
const memory = await import("./memory-store");

describe.skipIf(!enabled)("people store (database)", () => {
  db.current = enabled
    ? new PrismaClient({ datasources: { db: { url } } })
    : null;
  const tag = `t${Date.now()}`;
  const ids: string[] = [];
  const today = todayLocal();

  const person = async (name: string) => {
    const { person } = await people.createPerson({
      displayName: `${name} ${tag}`,
    });
    ids.push(person.id);
    return person;
  };
  const lastContact = async (id: string) =>
    (await people.getPersonProfile(id))!.lastContactOn;

  afterAll(async () => {
    await db.current?.interaction.deleteMany({
      where: { participants: { some: { personId: { in: ids } } } },
    });
    await db.current?.person.deleteMany({ where: { id: { in: ids } } });
    await db.current?.$disconnect();
  });

  it("keeps facts out of contact recency and shares one encounter", async () => {
    const sarah = await person("Sarah");
    const alex = await person("Alex");
    const jordan = await person("Jordan");

    await memory.addFact({
      personId: sarah.id,
      text: `Oldest child enjoys robotics ${tag}`,
    });
    expect(await lastContact(sarah.id)).toBeNull();

    const yesterday = addDays(today, -1);
    const { interaction } = await memory.logInteraction({
      occurredOn: yesterday,
      kind: "recommendation",
      summary: "Alex recommended Jordan's work at the fundraiser",
      participants: [
        { personId: sarah.id },
        { personId: alex.id },
        { personId: jordan.id, countsAsContact: false },
      ],
    });

    // One record, visible from every participant's profile.
    for (const p of [sarah, alex, jordan]) {
      const profile = await people.getPersonProfile(p.id);
      expect(profile!.interactions.map((i) => i.id)).toEqual([interaction.id]);
    }
    expect(await lastContact(sarah.id)).toBe(yesterday);
    expect(await lastContact(alex.id)).toBe(yesterday);
    expect(await lastContact(jordan.id)).toBeNull();

    // Recall by the remembered detail.
    const { people: hits } = await people.listPeople({
      search: `robotics ${tag}`,
    });
    expect(hits.map((h) => h.id)).toEqual([sarah.id]);
    expect(hits[0].matchedIn).toContain("robotics");
  });

  it("recomputes recency after a correction or archive", async () => {
    const a = await person("Casey");
    const older = addDays(today, -30);
    const newer = addDays(today, -2);
    await memory.logInteraction({
      occurredOn: older,
      summary: "Coffee",
      participants: [{ personId: a.id }],
    });
    const { interaction } = await memory.logInteraction({
      occurredOn: newer,
      summary: "Lunch",
      participants: [{ personId: a.id }],
    });
    expect(await lastContact(a.id)).toBe(newer);

    await memory.updateInteraction(interaction.id, {
      occurredOn: addDays(today, -40),
    });
    expect(await lastContact(a.id)).toBe(older);

    await memory.updateInteraction(interaction.id, {
      occurredOn: newer,
      archived: true,
    });
    expect(await lastContact(a.id)).toBe(older);

    await memory.updateInteraction(interaction.id, { archived: false });
    expect(await lastContact(a.id)).toBe(newer);
  });

  it("refuses impossible dates, future encounters, and unknown people", async () => {
    const a = await person("Riley");
    await expect(
      memory.logInteraction({
        occurredOn: "2026-02-30",
        summary: "x",
        participants: [{ personId: a.id }],
      }),
    ).rejects.toThrow(/calendar day/);
    await expect(
      memory.logInteraction({
        occurredOn: addDays(today, 1),
        summary: "x",
        participants: [{ personId: a.id }],
      }),
    ).rejects.toThrow(/future/);
    await expect(
      memory.addFact({ personId: "missing-person", text: "x" }),
    ).rejects.toThrow(/not found/);
  });

  it("returns the first record when a request key repeats", async () => {
    const a = await person("Morgan");
    const key = `req-${tag}`;
    const input = {
      occurredOn: today,
      summary: "Call about the robotics club",
      participants: [{ personId: a.id }],
      requestKey: key,
    };
    const first = await memory.logInteraction(input);
    const again = await memory.logInteraction(input);
    expect(again.existing).toBe(true);
    expect(again.interaction.id).toBe(first.interaction.id);
    const { interactions } = await memory.listPersonInteractions(a.id);
    expect(interactions).toHaveLength(1);
  });

  it("keeps an archived person's history and hides them from the directory", async () => {
    const a = await person("Avery");
    const b = await person("Blake");
    await memory.logInteraction({
      occurredOn: today,
      summary: "Walked the dogs",
      participants: [{ personId: a.id }, { personId: b.id }],
    });
    await people.updatePerson(a.id, { archived: true });
    const visible = await people.listPeople({ search: tag, limit: 200 });
    expect(visible.people.map((p) => p.id)).not.toContain(a.id);
    const profile = await people.getPersonProfile(b.id);
    expect(profile!.interactions[0].participants.map((p) => p.id)).toContain(
      a.id,
    );
  });
});
