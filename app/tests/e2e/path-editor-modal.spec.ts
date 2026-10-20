import { expect, test } from "@playwright/test";
import { ensureAuthed } from "./helpers/auth";
import {
  expectNotePath,
  openPathEditor,
  pathHint,
  pathInput,
  pathPopover,
} from "./helpers/paths";
import { waitForAppReady } from "./helpers/readiness";

test("sidebar new-note modal keeps a sequential path draft and saves it", async ({
  page,
}) => {
  test.setTimeout(120_000);

  const suffix = Date.now().toString();
  const title = `Modal path ${suffix}`;
  const firstSegment = `modal${suffix}`;
  const lastSegment = "nested";
  const typedPath = `${firstSegment}.${lastSegment}`;

  await ensureAuthed(page);
  await page.getByRole("button", { name: "New note", exact: true }).click();
  const modal = page.locator("[data-new-note-modal-content]");
  await expect(modal).toBeVisible();
  const heading = modal.locator('[contenteditable="true"] h1').first();
  await heading.fill(title);

  await openPathEditor(page);
  const input = pathInput(page);
  await input.click();
  await input.pressSequentially(typedPath);

  await expect(input).toBeFocused();
  await expect(input).toHaveValue(lastSegment);
  await expect(pathPopover(page)).toBeVisible();
  await expect(pathHint(page)).toBeVisible();
  await page.screenshot({
    path: "../tmp/path-editor-modal-sequential-draft.png",
    fullPage: true,
  });

  await input.press("Escape");
  await expect(pathHint(page)).toBeHidden();
  await expectNotePath(page, typedPath);

  const createResponse = page.waitForResponse((response) => {
    const serverId = response.request().headers()["x-server-id"] || "";
    return serverId.includes("--createDoc_action#");
  });
  await page.getByRole("button", { name: "Create note", exact: true }).click();
  const responseBody = await (await createResponse).text();
  const docId = responseBody.match(/\bc[a-z0-9]{24}\b/)?.[0];
  expect(docId, "create action should return the new document ID").toBeTruthy();
  console.info(`[path-editor-modal-e2e] ${title} created as ${docId}`);

  await expect(page).toHaveURL(new RegExp(`/docs/${docId}$`));
  await waitForAppReady(page);
  await expectNotePath(page, typedPath);
  await page.reload();
  await waitForAppReady(page);
  await expectNotePath(page, typedPath);
  await page.screenshot({
    path: "../tmp/path-editor-modal-reloaded-path.png",
    fullPage: true,
  });
});
