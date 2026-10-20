import { afterEach, describe, expect, it, vi } from "vitest";
import * as convert from "~/lib/note-content/convert";
import { noteText } from "./note-store";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("noteText", () => {
  it("extracts legacy text without building editor documents", () => {
    const read = vi
      .spyOn(convert, "contentFromLegacy")
      .mockImplementation(() => {
        throw new Error("Text-only reads must not convert editor content");
      });
    const text = noteText({
      html: '<style>hidden style</style><p>un<strong>expected</strong> caf&eacute; &#x1F600; &amp;</p><script>hidden script</script><p>next block</p><img src="image.png">',
      markdown: "stale markdown",
    });
    expect(text.replace(/\s+/g, " ")).toBe("unexpected café 😀 & next block");
    expect(noteText({ html: "<p></p>", markdown: "stale" })).toBe("");
    expect(
      noteText({ markdown: "# Heading\n\n**Fresh** text ^abcd1234" }),
    ).toBe("Heading\n\nFresh text");
    expect(read).not.toHaveBeenCalled();
  });

  it("prefers canonical blocks and respects the legacy read switch", () => {
    const row = {
      content: {
        type: "doc" as const,
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Current blocks" }],
          },
        ],
      },
      html: "<p>Legacy text</p>",
    };
    expect(noteText(row)).toBe("Current blocks");
    vi.stubEnv("NOTE_CONTENT_READ", "legacy");
    expect(noteText(row)).toBe("Legacy text");
  });
});
