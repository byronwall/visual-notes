import {
  expect,
  test,
  type Page,
  type Request,
  type Route,
} from "@playwright/test";
import { ensureAuthed } from "./helpers/auth";

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
  await page.locator("#new-note-title").fill(title);
  await page.getByRole("button", { name: "Unfiled", exact: true }).click();
  await pathInput(page).fill(path);
  await page.getByRole("button", { name: path, exact: true }).click();
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
        capture: (request: Request) => void;
        wait: Promise<void>;
        release: () => void;
      }
    | undefined;
  const pendingReleases: Array<() => void> = [];
  const interceptUpdate = async (route: Route) => {
    const request = route.request();
    const serverId = request.headers()["x-server-id"] || "";
    if (
      request.method() === "POST" &&
      serverId.includes("--updateDoc_action#") &&
      nextUpdate
    ) {
      const held = nextUpdate;
      nextUpdate = undefined;
      held.capture(request);
      await held.wait;
    }
    await route.continue();
  };
  await page.route("**/_server*", interceptUpdate);

  const deferNextUpdate = (): DeferredUpdate => {
    let capture!: (request: Request) => void;
    let release!: () => void;
    const request = new Promise<Request>((resolve) => {
      capture = resolve;
    });
    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    nextUpdate = { capture, wait, release };
    pendingReleases.push(release);
    return { request, release };
  };

  try {
    await expect(page).toHaveURL(new RegExp(`/docs/${noteAId}$`));
    await page.getByRole("button", { name: sharedPath, exact: true }).click();
    const input = pathInput(page);

    const latePath = `late-${suffix}`;
    const switchedNoteSave = deferNextUpdate();
    await input.fill(latePath);
    await savePathButton(page).click();
    await switchedNoteSave.request;

    await page
      .getByRole("button", { name: "Related notes in this path" })
      .click();
    await page.getByRole("button", { name: noteBTitle }).click();
    await expect(page).toHaveURL(new RegExp(`/docs/${noteBId}$`));
    await expect(page.getByText(noteBTitle, { exact: true })).toBeVisible();

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
    const sameNoteSave = deferNextUpdate();
    await input.fill(`submitted-${suffix}`);
    await savePathButton(page).click();
    await sameNoteSave.request;
    await input.fill(newerPath);
    sameNoteSave.release();
    const sameNoteResponse = await (await sameNoteSave.request).response();
    await sameNoteResponse?.finished();
    await expect(savePathButton(page)).toBeEnabled();
    await expect(input).toHaveValue(newerPath);
  } finally {
    for (const release of pendingReleases) release();
    await page.unroute("**/_server*", interceptUpdate);
  }
});
