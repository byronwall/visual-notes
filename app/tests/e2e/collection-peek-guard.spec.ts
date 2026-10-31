import { expect, test, type Route } from "@playwright/test";
import { uniqueSuffix } from "./helpers/fixtures";
import { waitForAppReady } from "./helpers/readiness";

// Closing a row peek unmounts its editor, which cancels the autosave and every
// retry. So a close must save first, or ask.

test("closing a row peek saves first, and asks when it can't", async ({
  page,
}) => {
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

  const open = async () => {
    await page.getByRole("button", { name: "Open Guarded row" }).click();
    const editor = page.locator("[data-side-panel-scroll] .ProseMirror");
    await editor.waitFor();
    return editor;
  };
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
