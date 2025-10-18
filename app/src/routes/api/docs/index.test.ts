import { describe, it, expect, vi, beforeEach } from "vitest";
import * as db from "~/server/db";
import { POST as postDocs } from "./index";
import { GET as listDocs } from "./index";
import { GET as getDoc } from "./[id]";

describe("Docs API", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("ingests markdown and fetches the saved doc", async () => {
    const fakeId = "doc_123";
    const create = vi.fn().mockResolvedValue({ id: fakeId });
    const findUnique = vi
      .fn()
      .mockResolvedValue({ id: fakeId, title: "T", html: "<p>x</p>" });
    vi.spyOn(db, "prisma", "get").mockReturnValue({
      doc: { create, findUnique },
    } as any);

    const postReq = new Request("http://x/api/docs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "T", markdown: "x" }),
    });
    const postRes = await postDocs({ request: postReq } as any);
    expect(postRes.status).toBe(201);
    const postJson = await postRes.json();
    expect(postJson.id).toBe(fakeId);
    expect(create).toHaveBeenCalledOnce();

    const getRes = await getDoc({ params: { id: fakeId } } as any);
    expect(getRes.status).toBe(200);
    const getJson = await getRes.json();
    expect(getJson.id).toBe(fakeId);
    expect(getJson.title).toBe("T");
    expect(getJson.html).toContain("<p>");
  });

  it("lists recent docs", async () => {
    const items = [
      { id: "a", title: "A", createdAt: new Date("2025-01-02T00:00:00Z") },
      { id: "b", title: "B", createdAt: new Date("2025-01-01T00:00:00Z") },
    ];
    const findMany = vi.fn().mockResolvedValue(items);
    vi.spyOn(db, "prisma", "get").mockReturnValue({
      doc: { findMany },
    } as any);

    const req = new Request("http://x/api/docs", { method: "GET" });
    const res = await listDocs({ request: req } as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.items)).toBe(true);
    expect(json.items.length).toBe(2);
    expect(json.items[0].id).toBe("a");
    expect(findMany).toHaveBeenCalledOnce();
  });
});
