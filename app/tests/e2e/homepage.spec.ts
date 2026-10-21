import { expect, test } from "@playwright/test";
import { ensureAuthed } from "./helpers/auth";
import { createNoteFixture, uniqueSuffix } from "./helpers/fixtures";

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

  test("recent list includes visited paths, not only notes", async ({
    page,
  }) => {
    await ensureAuthed(page);
    const leaf = `recent${uniqueSuffix()}`;
    await createNoteFixture(page, {
      title: `Recent path fixture ${leaf}`,
      markdown: "Body",
      path: `e2e.${leaf}`,
    });
    await page.goto(`/path/e2e/${leaf}`);
    const recent = page.getByRole("region", { name: "Recent" });
    await expect(recent.locator(`a[href="/path/e2e/${leaf}"]`)).toContainText(
      leaf,
    );

    // A tag with no blocks is a typo, not a place worth listing.
    await page.goto(`/tags/missing${leaf}`);
    await page.goto("/");
    await expect(recent.getByRole("link", { name: /missing/ })).toHaveCount(0);
  });
});
