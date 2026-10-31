import { expect, test, type Page, type Route } from "@playwright/test";
import {
  canSeedAuditDatabase,
  createNoteFixture,
  seedRevisionFixture,
  uniqueSuffix,
} from "./helpers/fixtures";
import { waitForAppReady } from "./helpers/readiness";

// Each test fails a save, or a load, and checks that the user's text survives.

const openNote = async (page: Page, body: string) => {
  const title = `Safety gap ${uniqueSuffix()}`;
  const noteId = await createNoteFixture(page, {
    title,
    markdown: `# ${title}\n\n${body}`,
  });
  await page.goto(`/docs/${noteId}`);
  await waitForAppReady(page);
  const editor = page.locator(".ProseMirror").first();
  await editor.getByText(body).click();
  await page.keyboard.press("End");
  return { editor, noteId, title };
};

/** Fails only the saves that carry `text`, so the page keeps loading. */
const failSavesWith = async (page: Page, text: string) => {
  const block = (route: Route) =>
    (route.request().postData() ?? "").includes(text)
      ? route.abort()
      : route.continue();
  await page.route("**/_server*", block);
  return () => page.unroute("**/_server*", block);
};

test("restore waits for a failed flush", async ({ page }) => {
  test.skip(!canSeedAuditDatabase(), "needs the audit database");
  const { editor, noteId, title } = await openNote(page, "Current line.");
  await seedRevisionFixture(noteId, title, "Restored line.");
  await page.reload();
  await waitForAppReady(page);
  await editor.getByText("Current line.").click();
  await page.keyboard.press("End");

  const restoreSaves = await failSavesWith(page, "draft text");
  await page.keyboard.type(" draft text");
  const failed = page.getByRole("button", { name: /Couldn't save/ });
  await expect(failed).toBeVisible();

  await page.getByRole("button", { name: "Note origin and versions" }).click();
  await page.getByRole("button", { name: "Restore" }).click();
  await expect(page.getByText("The restore did not run")).toBeVisible();

  // The retry lands, and the draft is the current version.
  await restoreSaves();
  await expect(failed).toBeHidden({ timeout: 35_000 });
  await expect(editor).toContainText("Current line. draft text");

  // Now the restore is safe, and no late save can undo it.
  await page.reload();
  await waitForAppReady(page);
  await page.getByRole("button", { name: "Note origin and versions" }).click();
  await page.getByRole("button", { name: "Restore" }).first().click();
  await expect(editor).toContainText("Restored line.");
  await expect(editor).not.toContainText("draft text");
  await page.reload();
  await waitForAppReady(page);
  await expect(editor).toContainText("Restored line.");
  await expect(editor).not.toContainText("draft text");
});

test("a failed note load keeps the panel's unsaved editor", async ({
  page,
}) => {
  await page.goto("/collections");
  await waitForAppReady(page);
  const name = page.getByLabel("New collection name");
  const newCollection = page.getByRole("button", { name: "New collection" });
  await name.or(newCollection).first().waitFor();
  if (await newCollection.count()) await newCollection.first().click();
  await name.fill(`Load guard ${uniqueSuffix()}`);
  await name.press("Enter");
  await page.waitForURL(/\/collections\/[^/]+$/);
  await waitForAppReady(page);

  for (const row of ["First row", "Second row"]) {
    await page
      .getByRole("button", { name: "New", exact: true })
      .first()
      .click();
    await page.getByLabel("Edit name").fill(row);
    await page.getByLabel("Edit name").press("Enter");
    await expect(
      page.getByRole("button", { name: `Open ${row}` }),
    ).toBeVisible();
  }

  await page.getByRole("button", { name: "Open First row" }).click();
  const editor = page.locator("[data-side-panel-scroll] .ProseMirror");
  await editor.waitFor();
  await editor.click();
  // The panel's own loads run on, so only the autosave fails.
  const restoreSaves = await failSavesWith(page, "failed load");
  await page.keyboard.type("kept through a failed load");
  const failed = page.getByRole("button", { name: /Couldn't save/ });
  await expect(failed).toBeVisible();
  await restoreSaves();
  const block = (route: Route) => route.abort();
  await page.route("**/_server*", block);

  // The panel's backdrop covers the row, so this click skips it.
  await page
    .getByRole("button", { name: "Open Second row" })
    .evaluate((button: HTMLElement) => button.click());
  await expect(
    page.getByRole("dialog", { name: "This note didn't save" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Stay" }).click();
  await expect(editor).toContainText("kept through a failed load");

  await page.unroute("**/_server*", block);
  await expect(failed).toBeHidden({ timeout: 35_000 });
  await page.reload();
  await waitForAppReady(page);
  await page.getByRole("button", { name: "Open First row" }).click();
  await expect(editor).toContainText("kept through a failed load");
});

test("the leave prompt over the phone drawer reaches a screen reader", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openNote(page, "Phone body.");
  await failSavesWith(page, "phone draft");
  await page.keyboard.type(" phone draft");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("link", { name: "Tasks" }).first().click();

  // getByRole skips anything hidden from the accessibility tree.
  await expect(page.getByText("This note didn't save")).toBeVisible({
    timeout: 35_000,
  });
  const prompt = page.getByRole("dialog", { name: "This note didn't save" });
  await expect(prompt).toBeVisible({ timeout: 2000 });
  await expect(prompt.getByRole("button", { name: "Stay" })).toBeVisible();
});

test("a failed New note or chat load says so", async ({ page }) => {
  await page.goto("/");
  await waitForAppReady(page);
  await page.route(/NewNoteModal|LLMSidebarHost/, (route) => route.abort());
  await page.getByRole("button", { name: "New note" }).first().click();
  await expect(page.getByText("Couldn't open New note").first()).toBeVisible();
  await page.getByRole("button", { name: "Chat" }).first().click();
  await expect(page.getByText("Couldn't open chat").first()).toBeVisible();
});
