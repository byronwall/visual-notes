import { expect, type Page } from "@playwright/test";
import { waitForAppReady } from "./readiness";

// Tests start signed in from the session saved by global-setup.ts. Only
// global setup passes the real test credential here; inside a traced test the
// typed value would be recorded, so tests may pass only a fixture password.
export const ensureAuthed = async (
  page: Page,
  options: { password?: string } = {},
) => {
  await page.goto("/");
  await waitForAppReady(page);
  await page.waitForLoadState("networkidle");
  const signInHeading = page.getByRole("heading", { name: /sign in/i });
  const needsLogin = await signInHeading.isVisible().catch(() => false);

  if (!needsLogin) return;

  if (!options.password) {
    throw new Error(
      "Not signed in. Global setup signs in when PLAYWRIGHT_MAGIC_PASSWORD_FILE (preferred) or PLAYWRIGHT_MAGIC_PASSWORD is set.",
    );
  }

  await page.getByRole("textbox").first().fill(options.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForLoadState("networkidle");
  await expect(page).not.toHaveURL((url) => url.pathname === "/login");
};
