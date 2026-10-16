import { expect, test } from "@playwright/test";
import { ensureAuthed } from "./helpers/auth";

test.use({ baseURL: "http://auth-helper.test" });

test("rejects a native form fallback that stays on the login path", async ({
  page,
}) => {
  const originalPassword = process.env.PLAYWRIGHT_MAGIC_PASSWORD;
  process.env.PLAYWRIGHT_MAGIC_PASSWORD = "fixture-password";

  try {
    await page.route("http://auth-helper.test/**", async (route) => {
      if (new URL(route.request().url()).pathname === "/login") {
        await route.fulfill({
          contentType: "text/html",
          body: '<html data-app-hydrated="true"><h1>Sign in failed</h1></html>',
        });
        return;
      }

      await route.fulfill({
        contentType: "text/html",
        body: `
        <html data-app-hydrated="true"><h1>Sign in</h1>
        <form action="/login?next=%2F" method="post">
          <input aria-label="Password" type="password" />
          <button type="submit">Sign in</button>
        </form></html>
      `,
      });
    });

    await expect(ensureAuthed(page)).rejects.toThrow();
    await expect(page).toHaveURL(/\/login\?next=%2F$/i);
  } finally {
    if (originalPassword === undefined) {
      delete process.env.PLAYWRIGHT_MAGIC_PASSWORD;
    } else {
      process.env.PLAYWRIGHT_MAGIC_PASSWORD = originalPassword;
    }
  }
});
