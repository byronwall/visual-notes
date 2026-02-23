import { expect, test } from "@playwright/test";
import { ensureAuthed } from "./helpers/auth";

test.describe("visual notes app", () => {
  test("loads homepage", async ({ page }) => {
    await ensureAuthed(page);
    await expect(page).toHaveTitle(/Visual Notes/i);
  });

  test("navigation renders key routes", async ({ page }) => {
    await ensureAuthed(page);
    await expect(page.getByRole("button", { name: /^canvas$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /paths/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /time blocks/i })).toBeVisible();
  });
});
