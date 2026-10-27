import { describe, expect, it } from "vitest";
import {
  databaseName,
  createRoleSql,
  passwordFile,
  preferredPort,
} from "../../scripts/audit-db.ts";

describe("audit-db", () => {
  it("names the database with the audit prefix", () => {
    expect(databaseName("hydration")).toBe("visual_notes_audit_hydration");
  });

  it("keeps the credential under TMPDIR per owner", () => {
    expect(passwordFile("flake")).toMatch(/vn-audit-flake\.password$/);
  });

  it("starts each owner at a stable port inside 3200-3399", () => {
    for (const owner of ["a", "collections", "live_updates", "mobile"]) {
      const port = preferredPort(owner);
      expect(port).toBe(preferredPort(owner));
      expect(port).toBeGreaterThanOrEqual(3200);
      expect(port).toBeLessThan(3400);
    }
  });

  it("creates the env file's role once, with quotes escaped", () => {
    const sql = createRoleSql(
      new URL("postgresql://vn:it's@localhost:5433/visual_notes_audit_x"),
    );
    expect(sql).toContain("rolname = 'vn'");
    expect(sql).toContain("PASSWORD 'it''s'");
  });
});
