import { expect, test } from "@playwright/test";
import { pinEditableByText } from "./helpers/editable";
import { createNoteFixture, uniqueSuffix } from "./helpers/fixtures";
import { waitForAppReady } from "./helpers/readiness";
import { holdNextServerAction, settled } from "./helpers/server-actions";

// Regression for PR #35: a failed title save on the real note route reverted
// the typed draft and closed the editor behind a native alert. The draft must
// stay editable with an inline error, and a retry must save it.

test("a failed title save keeps the draft for retry", async ({ page }) => {
  const title = `Inline title ${uniqueSuffix()}`;
  const draft = `${title} renamed`;
  const noteId = await createNoteFixture(page, {
    title,
    markdown: "Body for the inline title regression.",
  });
  const nativeDialogs: string[] = [];
  page.on("dialog", (dialog) => {
    nativeDialogs.push(dialog.message());
    void dialog.dismiss();
  });

  await page.goto(`/docs/${noteId}`);
  await waitForAppReady(page);
  const { root, preview, input } = await pinEditableByText(page, title);

  await preview.click();
  await expect(input).toBeVisible();
  await input.fill(draft);
  const failedSave = await holdNextServerAction(page, "updateDoc", [noteId]);
  await input.press("Enter");
  await failedSave.request;
  failedSave.fail();
  await settled(failedSave);

  const field = root.locator("xpath=..");
  await expect(field.getByRole("alert")).toBeVisible();
  await expect(input).toBeVisible();
  await expect(input).toHaveValue(draft);
  expect(nativeDialogs, "failure should be reported inline").toEqual([]);

  // Retry with the kept draft against the real server.
  const retry = await holdNextServerAction(page, "updateDoc", [noteId, draft]);
  await input.press("Enter");
  retry.release();
  await settled(retry);
  expect((await (await retry.request).response())?.ok()).toBe(true);
  await expect(input).toBeHidden();
  await expect(preview).toHaveText(draft);
  await expect(field.getByRole("alert")).toHaveCount(0);

  await page.reload();
  await waitForAppReady(page);
  await expect(
    page
      .locator('[data-scope="editable"][data-part="preview"]')
      .filter({ hasText: draft }),
  ).toHaveCount(1);
});
