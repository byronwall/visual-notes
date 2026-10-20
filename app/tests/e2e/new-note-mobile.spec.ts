import { devices, expect, test } from "@playwright/test";
import { waitForAppReady } from "./helpers/readiness";

// Regression: on phones (iOS home-screen PWA, Android), opening New note threw
// "Applying a mismatched transaction". TipTap's focus command calls
// view.dom.focus() synchronously on iOS/Android, and the core focusEvents
// extension dispatched its own transaction from inside that DOM event. A
// Pixel profile reports an Android user agent, so it takes the same path.
// The spec only opens the dialog and types; it never saves a note.

const { defaultBrowserType: _browser, ...pixel } = devices["Pixel 7"];
test.use(pixel);

test("new note opens and accepts typing on a phone", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await waitForAppReady(page);
  await page.getByRole("banner").getByRole("button", { name: "New note" }).tap();

  const dialog = page.getByRole("dialog");
  const editor = dialog.locator(".ProseMirror");
  await expect(editor).toBeVisible();
  await expect(editor).toBeFocused();

  await page.keyboard.type("Phone draft");
  await expect(editor.locator("h1")).toHaveText("Phone draft");
  expect(pageErrors).toEqual([]);

  await dialog.getByRole("button", { name: "Cancel" }).tap();
  await expect(dialog).toBeHidden();
});
