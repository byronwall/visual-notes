import { PrismaClient } from "@prisma/client";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, describe, expect, it, vi } from "vitest";
import { addDays, todayLocal } from "~/lib/people/dates";
import {
  testDatabaseEnabled as enabled,
  testDatabaseUrl as url,
} from "~/test/database";

// The People tools end to end: SDK client ↔ real server ↔ real People store.
// One agent round trip creates, reads, corrects, and archives records, and
// the identity, recency, retry, scope, and sharing rules hold along the way.

const { client: db } = vi.hoisted(() => ({
  client: { current: null as PrismaClient | null },
}));
vi.mock("~/server/db", () => ({
  get prisma() {
    return db.current;
  },
}));
vi.mock("~/server/events/action-events", () => ({ logActionEvent: vi.fn() }));
// Note search is out of scope here; `search` still returns its People group.
vi.mock("~/features/docs-index/data/docs.queries.search", () => ({
  searchDocs: vi.fn(async () => []),
}));
vi.mock("./semantic", () => ({
  scheduleEmbeddingRefresh: vi.fn(),
  semanticSearch: vi.fn(async () => ({ status: "off", hits: [] })),
}));
vi.mock("@solidjs/router", () => ({ query: (fn: unknown) => fn }));

const { createNotesMcpServer } = await import("./tools");
const { createNote } = await import("./notes-write");
const { getPublicSharedDoc } = await import("~/services/doc-shares.queries");

const full = {
  origin: "https://notes.test",
  actorId: "chatgpt:test",
  scopes: ["notes:read", "notes:write"],
  scopeChallenge: "",
  clientName: "Test agent",
};

type Json = Record<string, any>;

describe.skipIf(!enabled)("people tools (database)", () => {
  db.current = enabled
    ? new PrismaClient({ datasources: { db: { url } } })
    : null;
  const prisma = () => db.current!;
  const tag = `mcp${Date.now()}`;
  const personIds: string[] = [];
  const orgIds: string[] = [];
  const docIds: string[] = [];
  const today = todayLocal();

  const connect = async (ctx = full) => {
    const server = createNotesMcpServer(ctx);
    const client = new Client({ name: "people-test", version: "1.0.0" });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(b), client.connect(a)]);
    return client;
  };
  const call = async (client: Client, name: string, args: Json) => {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { text: string }[])[0].text;
    return {
      error: Boolean(result.isError),
      text,
      json: result.isError ? null : JSON.parse(text),
    };
  };

  afterAll(async () => {
    if (!db.current) return;
    await prisma().interaction.deleteMany({
      where: { participants: { some: { personId: { in: personIds } } } },
    });
    await prisma().person.deleteMany({ where: { id: { in: personIds } } });
    await prisma().organization.deleteMany({ where: { id: { in: orgIds } } });
    await prisma().doc.deleteMany({ where: { id: { in: docIds } } });
    await prisma().$disconnect();
  });

  it("lists the People tools with read and write annotations", async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    const people = tools.filter((t) => t.name.startsWith("people_"));
    expect(people.map((t) => t.name).sort()).toEqual([
      "people_add_fact",
      "people_add_followup",
      "people_create",
      "people_create_organization",
      "people_find_duplicates",
      "people_get",
      "people_get_organization",
      "people_import_career",
      "people_list_followups",
      "people_log_interaction",
      "people_query_facts",
      "people_query_interactions",
      "people_query_organizations",
      "people_query_relationships",
      "people_search",
      "people_update",
      "people_update_fact",
      "people_update_followup",
      "people_update_interaction",
      "people_update_organization",
      "people_update_relationship",
    ]);
    for (const t of people) {
      const reads = /_(search|get|query|find|list)/.test(t.name);
      expect(Boolean(t.annotations?.readOnlyHint), t.name).toBe(reads);
      expect(t.description?.length, t.name).toBeGreaterThan(40);
    }
  });

  it("runs a full agent round trip", async () => {
    const client = await connect();
    const name = `Sarah ${tag}`;

    // Create a person with a contact, then a second one to share an encounter.
    const org = await call(client, "people_create_organization", {
      name: `Acme ${tag}`,
    });
    orgIds.push(org.json.id);
    const sarah = await call(client, "people_create", {
      displayName: name,
      contexts: ["school"],
      summary: "Parent from the robotics club",
      contacts: [{ kind: "email", value: `sarah.${tag}@example.com` }],
      requestKey: `create-${tag}`,
    });
    expect(sarah.json.created).toBe(true);
    personIds.push(sarah.json.id);
    const alex = await call(client, "people_create", {
      displayName: `Alex ${tag}`,
    });
    personIds.push(alex.json.id);

    // A retry with the same key writes nothing new.
    const retry = await call(client, "people_create", {
      displayName: name,
      requestKey: `create-${tag}`,
    });
    expect(retry.json).toMatchObject({ created: false, id: sarah.json.id });

    // A same-name create without the key returns candidates and writes nothing.
    const dup = await call(client, "people_create", { displayName: name });
    expect(dup.json.created).toBe(false);
    expect(dup.json.candidates.map((c: Json) => c.id)).toEqual([sarah.json.id]);
    expect(await prisma().person.count({ where: { displayName: name } })).toBe(
      1,
    );

    // Add a role through a nested update; other fields stay.
    const updated = await call(client, "people_update", {
      id: sarah.json.id,
      affiliations: {
        add: [
          { organizationId: org.json.id, role: "Engineer", status: "current" },
        ],
      },
      setCustomFields: { Birthday: "May 4" },
    });
    expect(updated.json.changed).toEqual(
      expect.arrayContaining(["affiliations", "customFields"]),
    );

    const fact = await call(client, "people_add_fact", {
      personId: sarah.json.id,
      text: `Oldest child enjoys robotics ${tag}`,
      category: "Family",
      requestKey: `fact-${tag}`,
    });
    const encounter = await call(client, "people_log_interaction", {
      occurredOn: addDays(today, -3),
      kind: "in_person",
      summary: "Talked at the fundraiser",
      participants: [
        { personId: sarah.json.id },
        { personId: alex.json.id, countsAsContact: false },
      ],
      requestKey: `log-${tag}`,
    });
    expect(encounter.json.interaction.source.label).toBe("Agent: Test agent");
    const again = await call(client, "people_log_interaction", {
      occurredOn: addDays(today, -3),
      summary: "Talked at the fundraiser",
      participants: [{ personId: sarah.json.id }],
      requestKey: `log-${tag}`,
    });
    expect(again.json).toMatchObject({ created: false, id: encounter.json.id });

    // Find without an id: by name, by remembered fact, and through `search`.
    const byFact = await call(client, "people_search", {
      query: `robotics ${tag}`,
    });
    expect(byFact.json.people[0]).toMatchObject({ id: sarah.json.id });
    expect(byFact.json.people[0].matchedIn).toContain("robotics");
    const cross = await call(client, "search", {
      query: name,
      include: ["people"],
    });
    expect(cross.json.people[0]).toMatchObject({ id: sarah.json.id });

    // Read back.
    let got = await call(client, "people_get", { id: sarah.json.id });
    expect(got.json.person).toMatchObject({
      displayName: name,
      summary: "Parent from the robotics club",
      contexts: ["school"],
      customFields: { Birthday: "May 4" },
      currentRole: `Engineer, Acme ${tag}`,
      lastContactOn: addDays(today, -3),
    });
    expect(got.json.person.contacts).toHaveLength(1);
    expect(got.json.person.facts.map((f: Json) => f.id)).toEqual([
      fact.json.id,
    ]);
    const alexGot = await call(client, "people_get", { id: alex.json.id });
    expect(alexGot.json.person.lastContactOn).toBeNull();

    // Correct the fact and the encounter; recency follows the encounter.
    await call(client, "people_update_fact", {
      id: fact.json.id,
      text: "Oldest child enjoys robotics and chess",
    });
    await call(client, "people_update_interaction", {
      id: encounter.json.id,
      occurredOn: addDays(today, -1),
    });
    got = await call(client, "people_get", { id: sarah.json.id });
    expect(got.json.person.facts[0].text).toBe(
      "Oldest child enjoys robotics and chess",
    );
    expect(got.json.person.lastContactOn).toBe(addDays(today, -1));
    expect(got.json.person.summary).toBe("Parent from the robotics club");

    // Bad input is a refusal that writes nothing.
    const future = await call(client, "people_log_interaction", {
      occurredOn: addDays(today, 2),
      summary: "x",
      participants: [{ personId: sarah.json.id }],
    });
    expect(future.error).toBe(true);
    expect(future.text).toMatch(/invalid: .*future/);

    // Archive and restore keep the history.
    await call(client, "people_update", { id: sarah.json.id, archived: true });
    const hidden = await call(client, "people_search", { query: name });
    expect(hidden.json.people).toHaveLength(0);
    const archived = await call(client, "people_search", {
      query: name,
      archived: true,
    });
    expect(archived.json.people.map((p: Json) => p.id)).toEqual([
      sarah.json.id,
    ]);
    await call(client, "people_update", { id: sarah.json.id, archived: false });
    got = await call(client, "people_get", { id: sarah.json.id });
    expect(got.json.person.archived).toBe(false);
    expect(got.json.person.interactions).toHaveLength(1);

    // Paging through encounters.
    for (let i = 0; i < 3; i++) {
      await call(client, "people_log_interaction", {
        occurredOn: addDays(today, -10 - i),
        summary: `Call ${i}`,
        kind: "call",
        participants: [{ personId: alex.json.id }],
      });
    }
    const page1 = await call(client, "people_query_interactions", {
      personId: alex.json.id,
      limit: 2,
    });
    expect(page1.json.interactions).toHaveLength(2);
    expect(page1.json.nextCursor).toBe("2");
    const page2 = await call(client, "people_query_interactions", {
      personId: alex.json.id,
      limit: 2,
      cursor: page1.json.nextCursor,
    });
    expect(page2.json.interactions).toHaveLength(2);
    expect(page2.json.hasMore).toBe(false);
  });

  it("creates a person and its nested records together or not at all", async () => {
    const client = await connect();
    const name = `Atomic ${tag}`;
    const key = `atomic-${tag}`;
    const bad = await call(client, "people_create", {
      displayName: name,
      affiliations: [{ organizationId: "missing-org" }],
      requestKey: key,
    });
    expect(bad.error).toBe(true);
    expect(await prisma().person.count({ where: { displayName: name } })).toBe(
      0,
    );

    const org = await call(client, "people_create_organization", {
      name: `Atomic Org ${tag}`,
    });
    orgIds.push(org.json.id);
    const ok = await call(client, "people_create", {
      displayName: name,
      affiliations: [
        { organizationId: org.json.id, role: "Analyst", status: "current" },
      ],
      requestKey: key,
    });
    expect(ok.json.created).toBe(true);
    personIds.push(ok.json.id);
    const got = await call(client, "people_get", { id: ok.json.id });
    expect(got.json.person.currentRole).toBe(`Analyst, Atomic Org ${tag}`);
  });

  it("imports career rows with preview, resume, repeat, and kept edits", async () => {
    const client = await connect();
    const mk = async (displayName: string) => {
      const r = await call(client, "people_create", { displayName });
      personIds.push(r.json.id);
      return r.json.id as string;
    };
    const ana = await mk(`Ana Career ${tag}`);
    const ben = await mk(`Ben Career ${tag}`);
    const org = async (name: string) => {
      const r = await call(client, "people_create_organization", { name });
      orgIds.push(r.json.id);
      return r.json.id as string;
    };
    const allison = await org(`Allison ${tag}`);
    // Two organizations with one name: the import must not pick one.
    for (let i = 0; i < 2; i++) {
      const twin = await prisma().organization.create({
        data: { name: `Twin ${tag}` },
      });
      orgIds.push(twin.id);
    }
    // The export-style listing the import should complete, not duplicate.
    await call(client, "people_update", {
      id: ana,
      affiliations: { add: [{ organizationId: allison, role: "Engineer" }] },
    });

    const coll = await call(client, "collections_create", {
      name: `Career ${tag}`,
      properties: [
        { name: "Person URL", kind: "text" },
        { name: "Company", kind: "text" },
        { name: "Role", kind: "text" },
        { name: "Start month", kind: "text" },
        { name: "End month", kind: "text" },
        { name: "Employment", kind: "select", options: ["Current", "Past"] },
        { name: "Source URL", kind: "text" },
        { name: "Checked", kind: "date" },
      ],
    });
    const row = (who: string, values: Json) => ({
      title: String(values.Role ?? "Row"),
      values: {
        "Person URL": `https://notes.test/people/${who}`,
        "Source URL": "https://www.linkedin.com/in/ana-example/details/experience/",
        Checked: "2026-11-11",
        ...values,
      },
    });
    const anaLi = (v: Json) => row(ana, v);
    const benRow = (v: Json) => ({
      ...row(ben, v),
      values: {
        ...row(ben, v).values,
        "Source URL": "https://www.linkedin.com/in/ben-example/",
      },
    });
    await call(client, "collections_add_rows", {
      collection: coll.json.id,
      rows: [
        anaLi({ Company: `Allison ${tag}`, Role: "Engineer", "Start month": "2017-06", "End month": "2019-07", Employment: "Past" }),
        anaLi({ Company: `Allison ${tag}`, Role: "Senior Engineer", "Start month": "2019-08", "End month": "Present", Employment: "Current" }),
        benRow({ Company: `Allison ${tag}`, Role: "Analyst", "Start month": "2018-01", "End month": "2020-12", Employment: "Past" }),
        benRow({ Company: `Twin ${tag}`, Role: "Lead", "Start month": "2021" }),
        row("missing-person", { Company: "Nowhere", Role: "Ghost" }),
      ],
    });
    const roles = () =>
      prisma().personAffiliation.count({
        where: { personId: { in: [ana, ben] } },
      });

    const preview = await call(client, "people_import_career", {
      collection: coll.json.id,
    });
    expect(preview.json.counts).toEqual({
      create: 2,
      adopt: 1,
      unchanged: 0,
      conflict: 1,
      invalid: 1,
    });
    expect(await roles()).toBe(1);

    // A run stopped after one row resumes without repeating it.
    const first = await call(client, "people_import_career", {
      collection: coll.json.id,
      apply: true,
      limit: 1,
    });
    expect(first.json.written).toBe(1);
    const rest = await call(client, "people_import_career", {
      collection: coll.json.id,
      apply: true,
    });
    expect(rest.json.written).toBe(2);
    const again = await call(client, "people_import_career", {
      collection: coll.json.id,
      apply: true,
    });
    expect(again.json.written).toBe(0);
    expect(again.json.counts.unchanged).toBe(3);
    expect(await roles()).toBe(3);

    const got = (await call(client, "people_get", { id: ana })).json.person;
    expect(
      got.affiliations.map((a: Json) => [a.role, a.startOn, a.endOn, a.status]),
    ).toEqual([
      ["Senior Engineer", "2019-08", null, "current"],
      ["Engineer", "2017-06", "2019-07", "ended"],
    ]);
    expect(got.currentRole).toBe(`Senior Engineer, Allison ${tag}`);
    expect(got.lastContactOn).toBeNull();
    // Ben's 2018–2020 overlaps both of Ana's roles; the best one is shown.
    expect(got.colleagues).toEqual([
      expect.objectContaining({
        person: expect.objectContaining({ id: ben }),
        overlap: expect.objectContaining({ kind: "overlap" }),
      }),
    ]);
    expect(
      await prisma().personExternalIdentity.count({
        where: { personId: ana, source: "linkedin" },
      }),
    ).toBe(1);

    // A curated correction wins over the row and comes back as a conflict.
    const senior = got.affiliations[0];
    await call(client, "people_update", {
      id: ana,
      affiliations: { update: [{ id: senior.id, role: "Staff Engineer" }] },
    });
    const after = await call(client, "people_import_career", {
      collection: coll.json.id,
      apply: true,
    });
    expect(after.json.written).toBe(0);
    expect(
      after.json.rows.find((r: Json) => r.affiliationId === senior.id),
    ).toMatchObject({ outcome: "conflict" });

    await prisma().doc.deleteMany({ where: { collectionId: coll.json.id } });
    await prisma().collection.delete({ where: { id: coll.json.id } });
  });

  it("rolls back a cadence change when the rest of the update fails", async () => {
    const client = await connect();
    const a = await call(client, "people_create", {
      displayName: `Cadence A ${tag}`,
    });
    const b = await call(client, "people_create", {
      displayName: `Cadence B ${tag}`,
      contacts: [{ kind: "email", value: `b.${tag}@example.com` }],
    });
    personIds.push(a.json.id, b.json.id);
    const bContact = (await call(client, "people_get", { id: b.json.id })).json
      .person.contacts[0];
    const bad = await call(client, "people_update", {
      id: a.json.id,
      reconnectEveryDays: 30,
      contacts: { update: [{ id: bContact.id, value: "x@example.com" }] },
    });
    expect(bad.error).toBe(true);
    const row = await prisma().person.findUniqueOrThrow({
      where: { id: a.json.id },
    });
    expect(row.reconnectEveryDays).toBeNull();
  });

  it("refuses every write family for a read-only caller", async () => {
    const client = await connect({ ...full, scopes: ["notes:read"] });
    const writes: [string, Json][] = [
      ["people_create", { displayName: `Nope ${tag}` }],
      ["people_update", { id: "x", summary: "x" }],
      ["people_add_fact", { personId: "x", text: "x" }],
      ["people_update_fact", { id: "x", text: "x" }],
      [
        "people_log_interaction",
        { occurredOn: today, summary: "x", participants: [{ personId: "x" }] },
      ],
      ["people_update_interaction", { id: "x", summary: "x" }],
      ["people_create_organization", { name: `Nope ${tag}` }],
      ["people_update_organization", { id: "x", name: "x" }],
    ];
    for (const [name, args] of writes) {
      const r = await call(client, name, args);
      expect(r.error, name).toBe(true);
      expect(r.text, name).toMatch(/notes:write/);
    }
    const read = await call(client, "people_search", { query: tag });
    expect(read.error).toBe(false);
  });

  it("keeps People data out of a shared note", async () => {
    const note = await createNote(full, {
      title: `Fundraiser notes ${tag}`,
      markdown: "Talked with a few parents.",
    });
    docIds.push(note.id);
    const client = await connect();
    const p = await call(client, "people_create", {
      displayName: `Private Person ${tag}`,
      noteIds: [note.id],
    });
    personIds.push(p.json.id);
    await call(client, "people_add_fact", {
      personId: p.json.id,
      text: `Secret detail ${tag}`,
      sourceNoteId: note.id,
    });
    const slug = `people-${tag}`;
    await prisma().docShare.create({
      data: { docId: note.id, slug, shareUrl: `/share/${slug}` },
    });
    const shared = await getPublicSharedDoc(slug);
    expect(shared?.title).toBe(`Fundraiser notes ${tag}`);
    const out = JSON.stringify(shared);
    expect(out).not.toContain("Private Person");
    expect(out).not.toContain("Secret detail");
  });
});
