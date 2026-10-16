import { expect, test } from "@playwright/test";
import { ensureAuthed } from "./helpers/auth";
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
  await page.getByRole("button", { name: "New Note" }).click();
  await expect(page.locator("[data-new-note-modal-content]")).toBeVisible();
  const heading = page.locator('[contenteditable="true"] h1').first();
  await heading.fill(title);

  await page.getByRole("button", { name: "Unfiled", exact: true }).click();
  const input = page.getByPlaceholder("e.g. work.projects.alpha");
  const popover = page
    .locator('[data-scope="popover"][data-part="content"]')
    .filter({ has: input });
  await expect(input).toBeVisible();
  await input.click();
  await input.pressSequentially(typedPath);

  await expect(input).toBeFocused();
  await expect(input).toHaveValue(lastSegment);
  await expect(popover).toBeVisible();
  await expect(
    page.getByText(
      "Pick a child to continue nesting, or type a segment and hit",
    ),
  ).toBeVisible();
  await page.screenshot({
    path: "../tmp/path-editor-modal-sequential-draft.png",
    fullPage: true,
  });

  await input.press("Escape");
  await expect(input).toHaveValue(lastSegment);
  await expect(
    page.getByText(
      "Pick a child to continue nesting, or type a segment and hit",
    ),
  ).toBeHidden();
  await expect(
    page.getByRole("button", { name: typedPath, exact: true }),
  ).toBeVisible();

  const createResponse = page.waitForResponse((response) => {
    const serverId = response.request().headers()["x-server-id"] || "";
    return serverId.includes("--createDoc_action#");
  });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const responseBody = await (await createResponse).text();
  const docId = responseBody.match(/\bc[a-z0-9]{24}\b/)?.[0];
  expect(docId, "create action should return the new document ID").toBeTruthy();
  console.info(`[path-editor-modal-e2e] ${title} created as ${docId}`);

  await expect(page).toHaveURL(new RegExp(`/docs/${docId}$`));
  await waitForAppReady(page);
  await expect(
    page.getByRole("button", { name: typedPath, exact: true }),
  ).toBeVisible();
  await page.reload();
  await waitForAppReady(page);
  await expect(
    page.getByRole("button", { name: typedPath, exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "../tmp/path-editor-modal-reloaded-path.png",
    fullPage: true,
  });
});
