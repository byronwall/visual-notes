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

  test("recent list follows edits, not visits", async ({ page }) => {
    await ensureAuthed(page);
    const suffix = uniqueSuffix();
    const older = await createNoteFixture(page, {
      title: `Recent older ${suffix}`,
      markdown: "Body",
    });
    const newer = await createNoteFixture(page, {
      title: `Recent newer ${suffix}`,
      markdown: "Body",
    });
    const recent = page.getByRole("region", { name: "Recent" });
    const rowHrefs = () =>
      recent
        .locator("a[href^='/docs/']")
        .evaluateAll((links) => links.map((a) => a.getAttribute("href")));

    // Opening the older note must not move it above the newer one.
    await page.goto(`/docs/${older}`);
    await page.goto("/");
    await expect(recent.locator(`a[href="/docs/${newer}"]`)).toBeVisible();
    const hrefs = await rowHrefs();
    expect(hrefs.indexOf(`/docs/${newer}`)).toBeLessThan(
      hrefs.indexOf(`/docs/${older}`),
    );
  });
});
