import { describe, expect, it, vi } from "vitest";

vi.mock("~/server/db", () => ({ prisma: {} }));
const { iconLinks } = await import("./org-icon");

describe("iconLinks", () => {
  it("prefers touch icons, then larger sizes, and resolves relative hrefs", () => {
    const html = `
      <link rel="stylesheet" href="/a.css">
      <link rel="icon" href="/favicon-16.png" sizes="16x16">
      <link rel="icon" sizes="192x192" href="/icon-192.png">
      <link rel="apple-touch-icon" href="https://cdn.example.com/touch.png">
      <link rel="shortcut icon" href=bare.ico>`;
    expect(iconLinks(html, "https://acme.com/about/")).toEqual([
      "https://cdn.example.com/touch.png",
      "https://acme.com/icon-192.png",
      "https://acme.com/favicon-16.png",
      "https://acme.com/about/bare.ico",
    ]);
  });
});
