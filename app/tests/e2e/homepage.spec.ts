import { expect, test } from "@playwright/test";
import { ensureAuthed } from "./helpers/auth";

test.describe("visual notes app", () => {
  test("loads homepage", async ({ page }) => {
    await ensureAuthed(page);
    await expect(page).toHaveTitle(/Visual Notes/i);
  });

  test("navigation renders key routes", async ({ page }) => {
    await ensureAuthed(page);
    const sections = page.getByRole("list", { name: "Sections" });
    for (const [name, href] of [
      ["Canvas", "/canvas"],
      ["Paths", "/path"],
      ["Time Blocks", "/time-blocks"],
    ]) {
      await expect(
        sections.getByRole("link", { name, exact: true }),
      ).toHaveAttribute("href", href);
    }
  });

  test("recent list includes visited tags, not only notes", async ({
    page,
  }) => {
    await ensureAuthed(page);
    const tag = `recent${Date.now().toString(36)}`;
    await page.goto(`/tags/${tag}`);
    const recent = page.getByRole("region", { name: "Recent" });
    await expect(
      recent.getByRole("link", { name: new RegExp(`#${tag}`) }),
    ).toHaveAttribute("href", `/tags/${tag}`);
  });
});
