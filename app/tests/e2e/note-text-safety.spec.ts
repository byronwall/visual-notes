import { expect, test, type Route } from "@playwright/test";
import { createNoteFixture, uniqueSuffix } from "./helpers/fixtures";
import { waitForAppReady } from "./helpers/readiness";
import { isServerFn } from "./helpers/server-fn-id";

// Silent text loss is the worst failure in this app. The first test covers a
// save that fails until the network returns. The second covers Esc in New note.
// The third covers a blocked read beside an unsaved draft.

test("a failed save retries by itself and survives a reload", async ({
  page,
}) => {
  const title = `Save retry ${uniqueSuffix()}`;
  const noteId = await createNoteFixture(page, {
    title,
    markdown: `# ${title}\n\nBody line.`,
  });
  await page.goto(`/docs/${noteId}`);
  await waitForAppReady(page);
  const editor = page.locator(".ProseMirror");
  await editor.getByText("Body line.").click();
  await page.keyboard.press("End");

  const block = (route: { abort: () => Promise<void> }) => route.abort();
  await page.route("**/_server*", block);
  await page.keyboard.type(" kept text");
  const failed = page.getByRole("button", { name: /Couldn't save/ });
  await expect(failed).toBeVisible();

  await page.unroute("**/_server*", block);
  await expect(failed).toBeHidden({ timeout: 35_000 });

  await page.reload();
  await waitForAppReady(page);
  await expect(editor).toContainText("Body line. kept text");
});

test("Esc asks before it drops text in New note", async ({ page }) => {
  await page.goto("/");
  await waitForAppReady(page);
  await page.getByRole("button", { name: "New note" }).first().click();
  const dialog = page.getByRole("dialog");
  const editor = dialog.locator(".ProseMirror");
  await expect(editor).toBeFocused();

  await page.keyboard.type("Draft title");
  await page.keyboard.press("Escape");
  const prompt = dialog.getByRole("alert");
  await expect(prompt).toContainText("Discard this note?");
  await page.keyboard.press("Escape");
  await expect(prompt).toBeHidden();
  await expect(editor).toContainText("Draft title");

  await page.keyboard.press("Escape");
  await dialog.getByRole("button", { name: "Discard" }).click();
  await expect(dialog).toBeHidden();
});

test("a blocked read on an embedded collection keeps the draft", async ({
  page,
}) => {
  const title = `Embed read ${uniqueSuffix()}`;
  const noteId = await createNoteFixture(page, {
    title,
    markdown: `# ${title}\n\nBody line.`,
  });
  await page.goto(`/docs/${noteId}`);
  await waitForAppReady(page);
  const editor = page.locator(".ProseMirror");
  await editor.getByText("Body line.").click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");

  const blockRead = (route: Route) =>
    isServerFn(
      route.request().headers()["x-server-id"],
      "fetchCollectionViewBundle",
    )
      ? route.abort()
      : route.continue();
  await page.route("**/_server*", blockRead);
  await page.keyboard.type("/collection");
  await page.keyboard.press("Enter");
  const search = page.getByLabel("Search collections");
  await search.fill(`Embed ${uniqueSuffix()}`);
  await search.press("Enter");

  const embed = editor.locator("[data-collection-embed]");
  await expect(embed).toContainText("Couldn't load this view");
  await editor.getByText("Body line.").click();
  await page.keyboard.press("End");
  await page.keyboard.type(" draft line");
  await expect(page.getByText("Something went wrong")).toBeHidden();
  await expect(editor).toContainText("Body line. draft line");

  await page.unroute("**/_server*", blockRead);
  await embed.getByRole("button", { name: "Retry" }).click();
  await expect(embed.getByRole("link", { name: "Open" })).toBeVisible();
  await expect(editor).toContainText("Body line. draft line");
});
