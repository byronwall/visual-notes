import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Resolves the test-only login password without ever printing it. Shared by
// the e2e suite (tests/e2e/helpers/credential.ts) and the browser-check kit.
// Order: PLAYWRIGHT_MAGIC_PASSWORD_FILE, PLAYWRIGHT_MAGIC_PASSWORD,
// MAGIC_PASSWORD, then the local .env file. The .env fallback is skipped when
// PLAYWRIGHT_BASE_URL targets an explicit (audit) server, so an audit run never
// inherits the developer's real login value.
/** @returns {string | null} */
export const readTestCredential = () => {
  const file = process.env.PLAYWRIGHT_MAGIC_PASSWORD_FILE;
  if (file) {
    if ((statSync(file).mode & 0o077) !== 0) {
      throw new Error(
        "PLAYWRIGHT_MAGIC_PASSWORD_FILE must be readable only by its owner (chmod 600).",
      );
    }
    const value = readFileSync(file, "utf8").trim();
    if (!value) throw new Error("PLAYWRIGHT_MAGIC_PASSWORD_FILE is empty.");
    return value;
  }
  if (process.env.PLAYWRIGHT_MAGIC_PASSWORD) {
    return process.env.PLAYWRIGHT_MAGIC_PASSWORD;
  }
  if (process.env.MAGIC_PASSWORD) return process.env.MAGIC_PASSWORD;
  if (process.env.PLAYWRIGHT_BASE_URL) return null;

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
