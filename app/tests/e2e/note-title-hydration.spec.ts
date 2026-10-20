import { expect, test } from "@playwright/test";
import { createNoteFixture, uniqueSuffix } from "./helpers/fixtures";
import { waitForAppReady } from "./helpers/readiness";

// Regression: a note whose stored title differs from its first H1 renders the
// inline title editor on the server. Hydrating it threw "template is not a
// function" from Editable.Preview, and the error overlay then failed to
// hydrate too. The page must load, show the title, and accept key-by-key
// typing without a page error.

test("a note with a title that differs from its H1 hydrates", async ({ page }) => {
  const heading = `Hydration note ${uniqueSuffix()}`;
  const title = `${heading} abc`;
  const noteId = await createNoteFixture(page, {
    title,
    markdown: `# ${heading}\n\nBody for the title hydration regression.`,
  });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(`/docs/${noteId}`);
  await waitForAppReady(page);

  const preview = page
    .locator('[data-scope="editable"][data-part="preview"]')
    .filter({ hasText: title });
  await expect(preview).toHaveCount(1);
  await expect(preview).toBeVisible();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);

  await preview.click();
  const input = page.locator('[data-scope="editable"][data-part="input"]').first();
  await expect(input).toBeVisible();
  await input.press("End");
  await input.pressSequentially(" draft");
  await expect(input).toHaveValue(`${title} draft`);
  await input.press("Escape");
  await expect(input).toBeHidden();
  await expect(preview).toHaveText(title);

  expect(pageErrors, "the note page should hydrate without errors").toEqual([]);
});
