import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { chromium, type FullConfig } from "@playwright/test";
import { ensureAuthed } from "./helpers/auth";
import { readTestCredential } from "./helpers/credential";

export const storageStatePath = "playwright/.auth/user.json";

// Signs in once outside the traced test run so the password never appears in
// test traces, videos, or reports. Tests start from the saved session and
// ensureAuthed() becomes a no-op unless the session is rejected.
export default async function globalSetup(config: FullConfig) {
  mkdirSync(dirname(storageStatePath), { recursive: true });
  const baseURL = config.projects[0]?.use.baseURL;
  const password = readTestCredential();
  if (!baseURL || !password) {
    writeFileSync(
      storageStatePath,
      JSON.stringify({ cookies: [], origins: [] }),
    );
    return;
  }

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    // A cold `vinxi dev` server re-optimizes deps on the first page load and
    // force-reloads it, which can interrupt sign-in once. Retry before failing.
    const signIn = () => ensureAuthed(page, { password });
    try {
      await signIn().catch(signIn);
    } catch {
      throw new Error(
        `[e2e-setup] sign-in failed at ${new URL(page.url()).pathname}; check the test credential source.`,
      );
    }
    await context.storageState({ path: storageStatePath });
  } finally {
    await browser.close();
  }
}
