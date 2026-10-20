import { describe, expect, it } from "vitest";
import { loginPathFor, safeNextPath } from "./safe-next";

describe("safeNextPath", () => {
  it("keeps same-origin paths with queries", () => {
    expect(safeNextPath("/oauth/authorize?client_id=a&state=b")).toBe(
      "/oauth/authorize?client_id=a&state=b",
    );
  });

  it("rejects absolute, protocol-relative, and login loops", () => {
    expect(safeNextPath("https://evil.test")).toBeNull();
    expect(safeNextPath("//evil.test/x")).toBeNull();
    expect(safeNextPath("/\\evil.test")).toBeNull();
    expect(safeNextPath("/login?next=/x")).toBeNull();
  });
});

describe("loginPathFor", () => {
  it("encodes the return path and skips the root", () => {
    expect(loginPathFor("/docs/1?x=1")).toBe("/login?next=%2Fdocs%2F1%3Fx%3D1");
    expect(loginPathFor("/")).toBe("/login");
  });
});
