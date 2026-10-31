import { expect, test, type Page } from "@playwright/test";
import { createNoteFixture, uniqueSuffix } from "./helpers/fixtures";
import { waitForAppReady } from "./helpers/readiness";

// Enter in Cmd+K opens the best match. It must never fall through to New note
// while the results are on their way.

const openPalette = async (page: Page) => {
  await page.goto("/");
  await waitForAppReady(page);
  await page.keyboard.press("Meta+k");
  const search = page.getByRole("dialog").getByLabel("Search", { exact: true });
  await expect(search).toBeVisible();
  await search.focus();
  return search;
};

test("Enter opens the note that matches the search", async ({ page }) => {
  const title = `Palette target ${uniqueSuffix()}`;
  const noteId = await createNoteFixture(page, { title, markdown: "Body." });

  await openPalette(page);
  await page.keyboard.type(title);
  await expect(
    page.getByRole("listbox", { name: "Results" }).locator(`a[href="/docs/${noteId}"]`),
  ).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/docs/${noteId}$`));
});

test("Enter before the results arrive still opens the match", async ({ page }) => {
  const title = `Palette quick ${uniqueSuffix()}`;
  const noteId = await createNoteFixture(page, { title, markdown: "Body." });

  await openPalette(page);
  await page.keyboard.insertText(title);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/docs/${noteId}$`));
});

test("Enter with no match leaves New note for a second Enter", async ({ page }) => {
  const title = `Palette nothing ${uniqueSuffix()}`;

  const search = await openPalette(page);
  await page.keyboard.insertText(title);
  await page.keyboard.press("Enter");
  await expect(page.getByText("No results.")).toBeVisible();
  await expect(search).toBeVisible();

  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Create note" })).toBeVisible();
});
