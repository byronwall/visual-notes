import {
  expect,
  test,
  type Page,
  type Request,
  type Route,
} from "@playwright/test";
import { ensureAuthed } from "./helpers/auth";
import { waitForAppReady } from "./helpers/readiness";

const pathInput = (page: Page) =>
  page.getByPlaceholder("e.g. work.projects.alpha");

const pathPopover = (page: Page) =>
  page
    .locator('[data-scope="popover"][data-part="content"]')
    .filter({ has: pathInput(page) });

const savePathButton = (page: Page) =>
  pathPopover(page).getByRole("button", { name: "Save", exact: true });

const createNote = async (page: Page, title: string, path: string) => {
  await page.goto("/docs/new");
  await waitForAppReady(page);
  await page.locator("#new-note-title").fill(title);
  await page.getByRole("button", { name: "Unfiled", exact: true }).click();
  const input = pathInput(page);
  await input.pressSequentially(path);
  await expect(input).toHaveValue(path);
  const createResponse = page.waitForResponse((response) => {
    const serverId = response.request().headers()["x-server-id"] || "";
    return serverId.includes("--createDoc_action#");
  });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const responseBody = await (await createResponse).text();
  const responseId = responseBody.match(/\bc[a-z0-9]{24}\b/)?.[0];
  expect(
    responseId,
    "create action response should contain the new document ID",
  ).toBeTruthy();
  console.info(`[path-editor-e2e] ${title} created as ${responseId}`);
  await expect(page).toHaveURL(/\/docs\/(?!new$)[^/]+$/);
  const routedId = page.url().split("/").at(-1)!;
  expect(routedId).toBe(responseId);
  return responseId!;
};

test("late path saves do not replace a switched note or a newer draft", async ({
  page,
}) => {
  test.setTimeout(120_000);

  const suffix = Date.now().toString();
  const sharedPath = `path-race-${suffix}`;
  const noteBTitle = `Path race B ${suffix}`;
  const noteATitle = `Path race A ${suffix}`;

  await ensureAuthed(page);
  const noteBId = await createNote(page, noteBTitle, sharedPath);
  const noteAId = await createNote(page, noteATitle, sharedPath);

  type DeferredUpdate = {
    request: Promise<Request>;
    release: () => void;
  };
  let nextUpdate:
    | {
        expectedId: string;
        capture: (request: Request) => void;
        wait: Promise<void>;
        release: () => void;
      }
    | undefined;
  const pendingReleases: Array<() => void> = [];
  const interceptUpdate = async (route: Route) => {
    const request = route.request();
    const serverId = request.headers()["x-server-id"] || "";
    const postData = request.postData() || "";
    if (
      request.method() === "POST" &&
      serverId.includes("--updateDoc_action#") &&
      nextUpdate &&
      postData.includes(nextUpdate.expectedId)
    ) {
      const held = nextUpdate;
      nextUpdate = undefined;
      held.capture(request);
      await held.wait;
    }
    await route.continue();
  };
  await page.route("**/_server*", interceptUpdate);

  const deferNextUpdate = (expectedId: string): DeferredUpdate => {
    let capture!: (request: Request) => void;
    let release!: () => void;
    const request = new Promise<Request>((resolve) => {
      capture = resolve;
    });
    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    nextUpdate = { expectedId, capture, wait, release };
    pendingReleases.push(release);
    return { request, release };
  };

  try {
    await expect(page).toHaveURL(new RegExp(`/docs/${noteAId}$`));
    await page.getByRole("button", { name: sharedPath, exact: true }).click();
    const input = pathInput(page);

    const latePath = `late-${suffix}`;
    const switchedNoteSave = deferNextUpdate(noteAId);
    await input.fill(latePath);
    await savePathButton(page).click();
    const switchedRequest = await switchedNoteSave.request;
    expect(switchedRequest.postData()).toContain(noteAId);

    await page
      .getByRole("button", { name: "Related notes in this path" })
      .click();
    await page.getByRole("button", { name: noteBTitle }).click();
    await expect(page).toHaveURL(new RegExp(`/docs/${noteBId}$`));
    await expect(
      page
        .locator('[data-scope="editable"][data-part="preview"]')
        .filter({ hasText: noteBTitle }),
    ).toBeVisible();

    switchedNoteSave.release();
    const switchedResponse = await (await switchedNoteSave.request).response();
    await switchedResponse?.finished();
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    );
    await expect(
      page.getByRole("button", { name: sharedPath, exact: true }),
    ).toBeVisible();

    await page.getByRole("button", { name: sharedPath, exact: true }).click();
    const newerPath = `newer-${suffix}`;
    const sameNoteSave = deferNextUpdate(noteBId);
    await input.fill(`submitted-${suffix}`);
    await savePathButton(page).click();
    const sameNoteRequest = await sameNoteSave.request;
    expect(sameNoteRequest.postData()).toContain(noteBId);
    await input.fill(newerPath);
    sameNoteSave.release();
    const sameNoteResponse = await (await sameNoteSave.request).response();
    await sameNoteResponse?.finished();
    await expect(savePathButton(page)).toBeEnabled();
    await expect(input).toHaveValue(newerPath);
  } finally {
    for (const release of pendingReleases) release();
  }
});

test("path save actions remain reachable and new paths keep typed segments", async ({
  page,
}) => {
  test.setTimeout(120_000);

  const suffix = Date.now().toString();
  const title = `Path interactions ${suffix}`;
  const typedPath = `multichar${suffix}`;
  const pointerSegment = `pointer${suffix}`;
  const pointerPath = `${typedPath}.${pointerSegment}`;
  const keyboardPath = `keyboard${suffix}`;

  await ensureAuthed(page);
  const docId = await createNote(page, title, typedPath);

  await page.getByRole("button", { name: typedPath, exact: true }).click();
  const input = pathInput(page);
  await input.fill(pointerSegment);
  const pointerSave = page.waitForRequest((request) => {
    const serverId = request.headers()["x-server-id"] || "";
    return (
      request.method() === "POST" &&
      serverId.includes("--updateDoc_action#") &&
      (request.postData() || "").includes(docId)
    );
  });
  await savePathButton(page).click();
  await pointerSave;
  await expect(
    page.getByRole("button", { name: pointerPath, exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "../tmp/path-editor-pointer-save.png",
    fullPage: true,
  });

  await input.fill(keyboardPath);
  await input.press("Enter");
  await expect(
    page.getByRole("button", { name: keyboardPath, exact: true }),
  ).toBeVisible();
  await expect(input).toHaveValue("");

  await input.fill(`escape${suffix}`);
  await expect(
    page.getByText(
      "Pick a child to continue nesting, or type a segment and hit",
    ),
  ).toBeVisible();
  await input.press("Escape");
  await expect(input).toHaveValue(`escape${suffix}`);
  await expect(
    page.getByText(
      "Pick a child to continue nesting, or type a segment and hit",
    ),
  ).toBeHidden();

  await input.fill(`tab${suffix}`);
  let saveFocused = false;
  for (let i = 0; i < 50 && !saveFocused; i += 1) {
    await page.keyboard.press("Tab");
    saveFocused = await savePathButton(page)
      .evaluate((button) => document.activeElement === button)
      .catch(() => false);
  }
  expect(saveFocused).toBe(true);
  await expect(
    page.getByText(
      "Pick a child to continue nesting, or type a segment and hit",
    ),
  ).toBeVisible();
  const keyboardSave = page.waitForRequest((request) => {
    const serverId = request.headers()["x-server-id"] || "";
    return (
      request.method() === "POST" &&
      serverId.includes("--updateDoc_action#") &&
      (request.postData() || "").includes(docId)
    );
  });
  await page.keyboard.press("Enter");
  await keyboardSave;
  await expect(
    page.getByRole("button", {
      name: `${typedPath}.${keyboardPath}.tab${suffix}`,
      exact: true,
    }),
  ).toBeVisible();

  await page.goto("/");
  await waitForAppReady(page);
  await page.getByPlaceholder("Search notes...").fill(title);
  const row = page
    .getByText(title, { exact: true })
    .locator("xpath=ancestor::li[1]");
  await expect(row).toBeVisible();
  const rowCheckbox = row.getByRole("checkbox");
  await row.locator('[data-scope="checkbox"][data-part="root"]').click();
  await expect(rowCheckbox).toBeChecked();
  await page.getByRole("button", { name: "Selection" }).click();
  await page.getByRole("button", { name: "Set Path" }).click();
  const bulkInput = pathInput(page);
  await bulkInput.fill(`bulk${suffix}`);
  await page.screenshot({
    path: "../tmp/path-editor-bulk-apply.png",
    fullPage: true,
  });
  const bulkApplyRequest = page.waitForRequest((request) => {
    const serverId = request.headers()["x-server-id"] || "";
    return (
      request.method() === "POST" &&
      serverId.includes("--updateDoc_action#") &&
      (request.postData() || "").includes(docId)
    );
  });
  await page.getByRole("button", { name: "Apply to 1 items" }).click();
  await bulkApplyRequest;
  await expect(
    page.getByRole("dialog").filter({ hasText: "Bulk set path" }),
  ).toBeHidden();
});
