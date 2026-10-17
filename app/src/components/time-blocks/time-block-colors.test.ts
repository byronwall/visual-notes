import { describe, expect, it } from "vitest";
import { readableTextColor } from "./time-block-colors";

describe("readableTextColor", () => {
  it("keeps white text on dark fills", () => {
    expect(readableTextColor("#4f46e5")).toBe("white");
    expect(readableTextColor("hsl(230 52% 50%)")).toBe("white");
  });

  it("switches to dark text on light fills", () => {
    expect(readableTextColor("hsl(60 52% 50%)")).not.toBe("white");
    expect(readableTextColor("#fde047")).not.toBe("white");
    // Mid-tone amber and cyan read better dark than white.
    expect(readableTextColor("#d97706")).not.toBe("white");
    expect(readableTextColor("hsl(200 52% 50%)")).not.toBe("white");
  });

  it("falls back to white for unknown values", () => {
    expect(readableTextColor("var(--colors-blue-500)")).toBe("white");
  });
});
