import { describe, expect, it } from "vitest";
import { contactMatchValue } from "./contacts";
import { isRealDay } from "./dates";

describe("contactMatchValue", () => {
  it("keeps phone country codes only when typed", () => {
    expect(contactMatchValue("phone", "(317) 555-0100")).toBe("3175550100");
    expect(contactMatchValue("phone", "+1 317 555 0100")).toBe("+13175550100");
  });

  it("keeps meaningful URL paths", () => {
    expect(
      contactMatchValue("social", "https://www.linkedin.com/in/sam-q/"),
    ).toBe("linkedin.com/in/sam-q");
    expect(contactMatchValue("url", "example.com/team/a")).not.toBe(
      contactMatchValue("url", "example.com/team/b"),
    );
  });
});

describe("isRealDay", () => {
  it("rejects impossible days", () => {
    expect(isRealDay("2024-02-29")).toBe(true);
    expect(isRealDay("2026-02-29")).toBe(false);
    expect(isRealDay("2026-13-01")).toBe(false);
  });
});
