import { describe, expect, it } from "vitest";
import { checkLink, linkOnlyUrl, pageText } from "./link-check";

const page = (status: number, html = "", type = "text/html") =>
  (async () =>
    new Response(html, {
      status,
      headers: { "content-type": type },
    })) as unknown as typeof fetch;

describe("linkOnlyUrl", () => {
  it("finds a bare or labelled link with a few words around it", () => {
    expect(linkOnlyUrl("https://example.com/a")).toBe("https://example.com/a");
    expect(linkOnlyUrl("check this out: https://example.com/a.")).toBe(
      "https://example.com/a",
    );
    expect(linkOnlyUrl("- [Cool tool](https://tool.dev/x)")).toBe(
      "https://tool.dev/x",
    );
    // The editor writes autolinks with escaped labels.
    expect(
      linkOnlyUrl(
        "[https://en.wikipedia.org/wiki/Mortise\\_and\\_tenon](https://en.wikipedia.org/wiki/Mortise_and_tenon)",
      ),
    ).toBe("https://en.wikipedia.org/wiki/Mortise_and_tenon");
  });

  it("ignores notes with real writing or many links", () => {
    const prose =
      "I tried this and the clamp slipped twice, so next time I will glue the joint first and wait overnight before routing https://example.com";
    expect(linkOnlyUrl(prose)).toBeNull();
    expect(
      linkOnlyUrl("a https://a.co b https://b.co c https://c.co https://d.co"),
    ).toBeNull();
    expect(linkOnlyUrl("no links here")).toBeNull();
  });
});

describe("checkLink", () => {
  it("reads the title of a page that loads", async () => {
    const check = await checkLink(
      "https://example.com",
      page(200, "<html><title>Shop &amp; Jig</title></html>"),
    );
    expect(check).toMatchObject({ status: "ok", title: "Shop & Jig" });
  });

  it("calls 404 dead but a refused bot only blocked", async () => {
    expect((await checkLink("https://x.co", page(404))).status).toBe("dead");
    expect((await checkLink("https://x.co", page(403))).status).toBe("blocked");
    expect((await checkLink("https://x.co", page(429))).status).toBe("blocked");
  });

  it("calls a failed lookup dead and a timeout blocked", async () => {
    const fail = (name: string) =>
      (async () => {
        throw Object.assign(new Error(name), { name });
      }) as unknown as typeof fetch;
    expect((await checkLink("https://x.co", fail("TypeError"))).status).toBe(
      "dead",
    );
    expect((await checkLink("https://x.co", fail("TimeoutError"))).status).toBe(
      "blocked",
    );
  });
});

describe("pageText", () => {
  it("keeps readable text and drops scripts", () => {
    const text = pageText(
      "<p>One</p><script>var x = 1</script><p>Two &amp; three</p>",
    );
    expect(text).toContain("One");
    expect(text).toContain("Two & three");
    expect(text).not.toContain("var x");
  });
});
