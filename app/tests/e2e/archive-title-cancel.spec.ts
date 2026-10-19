import { expect, test, type Locator, type Page } from "@playwright/test";
import { createArchivedPageFixture, uniqueSuffix } from "./helpers/fixtures";
import { waitForAppReady } from "./helpers/readiness";
import { countServerActionPosts } from "./helpers/server-actions";

// Regression for PR #45: on the real Archive route, Escape after an unsaved
// title edit left the visible preview blank while every saved value was intact.
// The explicit preview child that fixed it later crashed while typing key by
// key, so each case types one character at a time.
// Since the Archive list redesign, the title is edited in the detail drawer.
// No observers or reactive probes are attached; the spec reads only the DOM.

const openArchiveRow = async (page: Page, title: string, host: string) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(`/archive?hostname=${host}`);
  await waitForAppReady(page);
  // Locate by host so a blank preview still resolves to the same row.
  const row = page.getByRole("row").filter({ hasText: host });
  await expect(row).toHaveCount(1);
  await row.click();
  const drawer = page.getByRole("dialog");
  const preview = drawer.locator('[data-scope="editable"][data-part="preview"]').first();
  await expect(preview).toHaveText(title);
  return {
    pageErrors,
    preview,
    input: drawer.locator('[data-scope="editable"][data-part="input"]').first(),
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
    const { pageErrors, preview, input } = await openArchiveRow(page, title, host);
    const posts = countServerActionPosts(page);

    await preview.click();
    await expect(input).toBeFocused();
    await input.pressSequentially(" unsaved draft", { delay: 30 });
    await expect(input).not.toHaveValue(title);
    await input.press("Escape");

    await expectRestored(page, preview, input, title);
    expect(posts, "cancel must not save").toEqual([]);
    expect(pageErrors, "typing must not crash the route").toEqual([]);
  });

  test("Escape after a keyboard edit restores the visible title", async ({
    page,
  }) => {
    const { pageErrors, preview, input } = await openArchiveRow(page, title, host);
    const posts = countServerActionPosts(page);

    await preview.focus();
    await preview.press("Enter");
    await expect(input).toBeFocused();
    await input.pressSequentially(" keyboard draft", { delay: 30 });
    await expect(input).not.toHaveValue(title);
    await input.press("Escape");

    await expectRestored(page, preview, input, title);
    expect(posts, "cancel must not save").toEqual([]);
    expect(pageErrors, "typing must not crash the route").toEqual([]);
  });
});
