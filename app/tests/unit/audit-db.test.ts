import { describe, expect, it } from "vitest";
import {
  databaseName,
  devPostgresRunArgs,
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

  it("binds vn-dev-pg to the env file's loopback port and passes secrets by name", () => {
    const args = devPostgresRunArgs(
      new URL("postgresql://vn:s3cret@localhost:5433/visual_notes_audit_x"),
    );
    expect(args).toContain("127.0.0.1:5433:5432");
    expect(args).toContain("vn-dev-pg");
    expect(args.join(" ")).not.toContain("s3cret");
  });
});
