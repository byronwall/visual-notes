import { expect, test, type Locator, type Page } from "@playwright/test";
import { createArchivedPageFixture, uniqueSuffix } from "./helpers/fixtures";
import { waitForAppReady } from "./helpers/readiness";
import { countServerActionPosts } from "./helpers/server-actions";

// Regression for PR #45: on the real Archive route, Escape after an unsaved
// title edit left the visible preview blank while every saved value was intact.
// No observers or reactive probes are attached; the spec reads only the DOM.

const openArchiveRow = async (page: Page, title: string, host: string) => {
  await page.goto(`/archive?hostname=${host}`);
  await waitForAppReady(page);
  // Locate by host so a blank preview still resolves to the same row.
  const row = page.getByRole("row").filter({ hasText: host });
  await expect(row).toHaveCount(1);
  const preview = row.locator('[data-scope="editable"][data-part="preview"]');
  await expect(preview).toHaveText(title);
  return {
    preview,
    input: row.locator('[data-scope="editable"][data-part="input"]'),
  };
};

const expectRestored = async (
  page: Page,
  preview: Locator,
  input: Locator,
  title: string,
) => {
  await expect(input).toBeHidden();
  await expect(preview).toHaveText(title);
  await expect(preview).toBeVisible();
  // The original failure could appear after the cancel settled.
  await page.waitForTimeout(800);
  await expect(preview).toHaveText(title);
  await expect(input).toHaveValue(title);
};

test.describe("archive title cancel", () => {
  let title: string;
  let host: string;

  test.beforeEach(async ({ request }) => {
    const suffix = uniqueSuffix();
    title = `Archive cancel ${suffix}`;
    host = `archive-cancel-${suffix}.example.test`;
    await createArchivedPageFixture(request, {
      title,
      url: `https://${host}/page`,
    });
  });

  test("Escape after a pointer edit restores the visible title", async ({
    page,
  }) => {
    const { preview, input } = await openArchiveRow(page, title, host);
    const posts = countServerActionPosts(page);

    // A single click selects nothing and keeps focus; a double click edits.
    await preview.click();
    await expect(input).toBeHidden();
    await preview.dblclick();
    await expect(input).toBeFocused();
    await input.pressSequentially(" unsaved draft");
    await expect(input).not.toHaveValue(title);
    await input.press("Escape");

    await expectRestored(page, preview, input, title);
    expect(posts, "cancel must not save").toEqual([]);
  });

  test("Escape after a keyboard edit restores the visible title", async ({
    page,
  }) => {
    const { preview, input } = await openArchiveRow(page, title, host);
    const posts = countServerActionPosts(page);

    await preview.focus();
    await preview.press("Enter");
    await expect(input).toBeFocused();
    await input.pressSequentially(" keyboard draft");
    await expect(input).not.toHaveValue(title);
    await input.press("Escape");

    await expectRestored(page, preview, input, title);
    expect(posts, "cancel must not save").toEqual([]);
  });
});
