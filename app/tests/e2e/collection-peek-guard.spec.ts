import { expect, test, type Page, type Route } from "@playwright/test";
import { uniqueSuffix } from "./helpers/fixtures";
import { waitForAppReady } from "./helpers/readiness";
import { isServerFn } from "./helpers/server-fn-id";

// Closing a row peek unmounts its editor, which cancels the autosave and every
// retry. So a close must save first, or ask.

const openGuardedRow = async (page: Page) => {
  await page.goto("/collections");
  await waitForAppReady(page);
  const name = page.getByLabel("New collection name");
  const newCollection = page.getByRole("button", { name: "New collection" });
  await name.or(newCollection).first().waitFor();
  if (await newCollection.count()) await newCollection.first().click();
  await name.fill(`Peek guard ${uniqueSuffix()}`);
  await name.press("Enter");
  await page.waitForURL(/\/collections\/[^/]+$/);
  await waitForAppReady(page);

  await page.getByRole("button", { name: "New", exact: true }).first().click();
  await page.getByLabel("Edit name").fill("Guarded row");
  await page.getByLabel("Edit name").press("Enter");
};

const openPeek = async (page: Page) => {
  await page.getByRole("button", { name: "Open Guarded row" }).click();
  const editor = page.locator("[data-side-panel-scroll] .ProseMirror");
  await editor.waitFor();
  return editor;
};

test("closing a row peek saves first, and asks when it can't", async ({
  page,
}) => {
  await openGuardedRow(page);
  const open = () => openPeek(page);
  const closeButton = page.getByRole("button", { name: "Close panel" });

  // A failed save: the panel stays until the user chooses.
  const editor = await open();
  await editor.click();
  await page.keyboard.type("kept text");
  // After the panel's own loads, so only the autosave fails.
  const block = (route: Route) => route.abort();
  await page.route("**/_server*", block);
  const failed = page.getByRole("button", { name: /Couldn't save/ });
  await expect(failed).toBeVisible();
  await closeButton.click();
  await expect(page.getByText("This note didn't save")).toBeVisible();
  await page.getByRole("button", { name: "Stay" }).click();
  await expect(editor).toContainText("kept text");

  // The network returns: the retry lands and the close is clean.
  await page.unroute("**/_server*", block);
  await expect(failed).toBeHidden({ timeout: 35_000 });
  await closeButton.click();
  await expect(closeButton).toBeHidden();

  // A working network: the close saves text the autosave had not reached.
  await (await open()).click();
  await page.keyboard.press("End");
  await page.keyboard.type(" quick text");
  await closeButton.click();
  await expect(closeButton).toBeHidden();
  await expect(await open()).toContainText("kept text quick text");
});

// A reopen within seconds of a close can read the cached note. If that copy is
// older than the save, the next edit replaces the saved text. The socket's
// refresh and the view log's bare action can both land after the reopen, so
// here neither does: the save alone must refresh the cache.
test("a reopen right after a close shows the saved text", async ({ page }) => {
  await page.routeWebSocket("**/ws/notes", (ws) => {
    const server = ws.connectToServer();
    ws.onMessage((message) => server.send(message));
    server.onMessage((message) => {
      if (!String(message).includes("notes:changed")) ws.send(message);
    });
  });
  await page.route("**/_server*", (route) => {
    // Held, never answered: a failed action would raise the error page.
    if (isServerFn(route.request().headers()["x-server-id"], "logDocViewEvent"))
      return;
    return route.continue();
  });
  await openGuardedRow(page);
  const closeButton = page.getByRole("button", { name: "Close panel" });
  const panel = page.locator("[data-side-panel-scroll]");

  await (await openPeek(page)).click();
  await page.keyboard.type("quick text");
  await closeButton.click();
  // Until the exit animation ends, a reopen gets the same editor back.
  await expect(panel).toHaveCount(0);

  const editor = await openPeek(page);
  await expect(editor).toContainText("quick text");
  await editor.click();
  await page.keyboard.press("End");
  await page.keyboard.type(" and more");
  await closeButton.click();
  await expect(panel).toHaveCount(0);
  await expect(await openPeek(page)).toContainText("quick text and more");
});

// A landed action revalidates every live query. If one of those reads fails,
// it must not take the page, and the draft in it, down with it.
test("a failed read leaves an open row peek and its draft", async ({
  page,
}) => {
  await openGuardedRow(page);
  const editor = await openPeek(page);
  await editor.click();

  await page.route("**/_server*", (route) =>
    isServerFn(route.request().headers()["x-server-id"], "saveDocContent")
      ? route.continue()
      : route.abort(),
  );
  // The saved text comes back as a live change, which refreshes this read.
  const failedRead = page.waitForEvent("requestfailed", (request) =>
    isServerFn(request.headers()["x-server-id"], "fetchDocActivityHistory"),
  );
  await page.keyboard.type("kept text");
  await failedRead;

  await expect(page.getByText("Something went wrong")).toBeHidden();
  await expect(page.getByText("Client exception")).toBeHidden();
  await page.keyboard.type(" and more");
  await expect(editor).toContainText("kept text and more");
});
