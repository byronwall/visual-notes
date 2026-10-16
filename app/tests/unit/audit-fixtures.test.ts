import { describe, expect, it } from "vitest";
import { auditDatabaseUrl } from "../../scripts/audit-harness.ts";
import {
  parseManifest,
  recordFixture,
  resolveOwnedFixture,
  withoutFixture,
  type FixtureEntry,
} from "../../scripts/audit-fixtures.ts";

const fixture = (id: string): FixtureEntry => ({
  entityKind: "Doc",
  id,
  route: `http://127.0.0.1:3113/docs/${id}`,
  title: "Untitled",
});

const editor = recordFixture(
  null,
  "editor",
  "visual_notes_audit_shared",
  fixture("doc-editor"),
);
const share = recordFixture(
  null,
  "share",
  "visual_notes_audit_shared",
  fixture("doc-share"),
);

describe("audit fixture ownership", () => {
  it("lets each owner resolve only its own same-title fixture", () => {
    expect(
      resolveOwnedFixture(share, "share", "visual_notes_audit_shared", "doc-share")
        .id,
    ).toBe("doc-share");
    expect(() =>
      resolveOwnedFixture(share, "share", "visual_notes_audit_shared", "doc-editor"),
    ).toThrow(/not recorded for share/);
    expect(() =>
      resolveOwnedFixture(editor, "share", "visual_notes_audit_shared", "doc-editor"),
    ).toThrow(/belongs to editor/);
  });

  it("refuses a wrong database or entity kind", () => {
    expect(() =>
      resolveOwnedFixture(share, "share", "visual_notes_audit_other", "doc-share"),
    ).toThrow(/database/);
    expect(() =>
      resolveOwnedFixture(
        share,
        "share",
        "visual_notes_audit_shared",
        "doc-share",
        "ArchivedPage",
      ),
    ).toThrow(/recorded as Doc/);
  });

  it("refuses duplicate records and records from another scope", () => {
    expect(() =>
      recordFixture(share, "share", "visual_notes_audit_shared", fixture("doc-share")),
    ).toThrow(/already recorded/);
    expect(() =>
      recordFixture(share, "editor", "visual_notes_audit_shared", fixture("doc-x")),
    ).toThrow(/belongs to share/);
  });

  it("removes only the cleaned fixture and round-trips the manifest", () => {
    const both = recordFixture(
      share,
      "share",
      "visual_notes_audit_shared",
      fixture("doc-share-2"),
    );
    const remaining = withoutFixture(both, "doc-share");
    expect(remaining.fixtures.map((entry) => entry.id)).toEqual(["doc-share-2"]);
    expect(parseManifest(JSON.stringify(remaining))).toEqual(remaining);
  });

  it("rejects manifests without created IDs or routes", () => {
    expect(() =>
      parseManifest(
        JSON.stringify({ owner: "a", database: "d", fixtures: [{ entityKind: "Doc" }] }),
      ),
    ).toThrow(/created ID/);
    expect(() =>
      parseManifest(
        JSON.stringify({
          owner: "a",
          database: "d",
          fixtures: [{ entityKind: "Doc", id: "x" }],
        }),
      ),
    ).toThrow(/route/);
  });

  it("only targets synthetic loopback databases", () => {
    const url = "postgresql://u:p@localhost:5432/source";
    expect(auditDatabaseUrl(url, {}, "visual_notes_audit_a").pathname).toBe(
      "/visual_notes_audit_a",
    );
    expect(() => auditDatabaseUrl(url, {}, "visual_notes")).toThrow(/start with/);
    expect(() =>
      auditDatabaseUrl("postgresql://db.example.com/x", {}, "visual_notes_audit_a"),
    ).toThrow(/loopback/);
  });
});
