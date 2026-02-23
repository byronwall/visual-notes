import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";

const parseEnvPassword = () => {
  if (process.env.PLAYWRIGHT_MAGIC_PASSWORD) {
    return process.env.PLAYWRIGHT_MAGIC_PASSWORD;
  }
  if (process.env.MAGIC_PASSWORD) {
    return process.env.MAGIC_PASSWORD;
  }

  try {
    const envText = readFileSync(join(process.cwd(), ".env"), "utf8");
    const line = envText
      .split(/\r?\n/)
      .find((entry) => entry.trim().startsWith("MAGIC_PASSWORD="));
    if (!line) return null;
    return line.split("=").slice(1).join("=").trim().replace(/^"|"$/g, "");
  } catch {
    return null;
  }
};

export const ensureAuthed = async (page: Page) => {
  await page.goto("/");
  const signInHeading = page.getByRole("heading", { name: /sign in/i });
  const needsLogin = await signInHeading.isVisible().catch(() => false);

  if (!needsLogin) return;

  const password = parseEnvPassword();
  if (!password) {
    throw new Error(
      "No MAGIC_PASSWORD available for Playwright auth. Set PLAYWRIGHT_MAGIC_PASSWORD or MAGIC_PASSWORD."
    );
  }

  await page.getByRole("textbox").first().fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).not.toHaveURL(/\/login$/);
};
