import { expect, test } from "@playwright/test";
import { createNoteFixture, uniqueSuffix } from "./helpers/fixtures";
import { waitForAppReady } from "./helpers/readiness";

// Session cookies must not appear in retained traces.
test.use({ trace: "off" });

test("keeps a draft when the session is lost and saves when restored", async ({
  page,
  context,
}) => {
  const noteId = await createNoteFixture(page, {
    title: `Expired ${uniqueSuffix()}`,
    markdown: "Session body.",
  });
  await page.goto(`/docs/${noteId}`);
  await waitForAppReady(page);
  const editor = page.locator(".ProseMirror");
  await expect(editor).toContainText("Session body.");
  const { cookies } = await context.storageState();
  await context.clearCookies();
  await editor.getByText("Session body.").click();
  await page.keyboard.press("End");
  await page.keyboard.type(" kept after login");
  await expect(
    page.getByRole("link", { name: /Not saved.*Sign in/ }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(editor).toContainText("kept after login");
  // Restore the existing test session without putting its credential in a trace.
  await context.addCookies(cookies);
  await page.bringToFront();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    page.getByRole("link", { name: /Not saved.*Sign in/ }),
  ).toBeHidden({ timeout: 15_000 });
  await page.reload();
  await waitForAppReady(page);
  await expect(editor).toContainText("Session body. kept after login");
});
