import { expect, test, type Page } from "@playwright/test";
import { ensureAuthed } from "./helpers/auth";
import { waitForAppReady } from "./helpers/readiness";

// A read with no closer boundary suspends the app shell, which drops the whole
// page for a frame or longer. Samples <main> on every frame around an overlay's
// first open.
const watchMain = (page: Page) =>
  page.evaluate(() => {
    const count = () =>
      document.querySelector("main")?.querySelectorAll("*").length ?? 0;
    const watch = { base: count(), min: count(), stop: false };
    const tick = () => {
      if (watch.stop) return;
      watch.min = Math.min(watch.min, count());
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    (window as { __mainWatch?: typeof watch }).__mainWatch = watch;
  });

const readMain = (page: Page) =>
  page.evaluate(() => {
    const { __mainWatch: watch } = window as unknown as {
      __mainWatch: { base: number; min: number; stop: boolean };
    };
    watch.stop = true;
    return { base: watch.base, min: watch.min };
  });

test("the command palette and chat open without unmounting the page", async ({
  page,
}) => {
  await ensureAuthed(page);
  for (const open of [
    async () => {
      await page.keyboard.press("Meta+k");
      await page.getByRole("dialog").first().waitFor();
    },
    () =>
      page
        .locator("nav,aside")
        .getByRole("button", { name: "Chat", exact: true })
        .first()
        .click(),
  ]) {
    await page.goto("/");
    await waitForAppReady(page);
    await watchMain(page);
    await open();
    await page.waitForLoadState("networkidle");
    const { base, min } = await readMain(page);
    expect(min).toBeGreaterThan(base / 2);
  }
});
