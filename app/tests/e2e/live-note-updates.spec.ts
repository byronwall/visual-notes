import { expect, test, type Browser, type Page } from "@playwright/test";
import { storageStatePath } from "./global-setup";
import { createNoteFixture, uniqueSuffix } from "./helpers/fixtures";
import { waitForAppReady } from "./helpers/readiness";

// Live note updates: a write made somewhere other than this tab must reach it
// without a reload, and must never replace typing that is not saved yet. The
// "elsewhere" writer is a second browser context using the CLI ingest API,
// whose update returns no updatedAt, so the tab has to fetch and compare.

const SOURCE = "e2e-live-updates";

const waitForLiveSocket = (page: Page) =>
  expect(page.locator("html")).toHaveAttribute("data-note-live", "open");

const openElsewhere = async (browser: Browser) => {
  const context = await browser.newContext({ storageState: storageStatePath });
  const page = await context.newPage();
  await page.goto("/login");
  return { page, close: () => context.close() };
};

/** Re-ingests the note with new markdown, as the CLI would. */
const ingestUpdate = async (
  page: Page,
  note: { title: string; contentId: string; markdown: string },
) => {
  const status = await page.evaluate(
    async (data) => {
      const response = await fetch("/api/docs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: data.title,
          markdown: data.markdown,
          originalSource: data.source,
          originalContentId: data.contentId,
        }),
      });
      return response.status;
    },
    { ...note, source: SOURCE },
  );
  expect(status, "ingest update should succeed").toBe(200);
};

const editor = (page: Page) => page.locator(".ProseMirror").first();

test("a note created elsewhere appears in the open notes list", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await waitForAppReady(page);
  await waitForLiveSocket(page);

  const elsewhere = await openElsewhere(browser);
  const title = `Live list ${uniqueSuffix()}`;
  try {
    await createNoteFixture(elsewhere.page, {
      title,
      markdown: "Created in another context.",
    });
  } finally {
    await elsewhere.close();
  }

  await expect(page.getByRole("link", { name: title }).first()).toBeVisible({
    timeout: 5_000,
  });
});

test.describe("open note", () => {
  let noteId: string;
  let title: string;
  let contentId: string;

  test.beforeEach(async ({ page }) => {
    title = `Live note ${uniqueSuffix()}`;
    contentId = `live-${uniqueSuffix()}`;
    noteId = await createNoteFixture(page, {
      title,
      markdown: "Original body.",
      originalSource: SOURCE,
      originalContentId: contentId,
    });
    await page.goto(`/docs/${noteId}`);
    await waitForAppReady(page);
    await waitForLiveSocket(page);
    await expect(editor(page)).toContainText("Original body.");
  });

  test("takes changes from elsewhere when it has no local edits", async ({
    page,
    browser,
  }) => {
    const elsewhere = await openElsewhere(browser);
    try {
      await ingestUpdate(elsewhere.page, {
        title,
        contentId,
        markdown: "Original body.\n\nAdded from the CLI.",
      });
    } finally {
      await elsewhere.close();
    }

    await expect(editor(page)).toContainText("Added from the CLI.", {
      timeout: 5_000,
    });
    await expect(page.getByTestId("remote-change-notice")).toHaveCount(0);
  });

  test("keeps unsaved edits and offers a reload", async ({ page, browser }) => {
    const elsewhere = await openElsewhere(browser);
    try {
      await editor(page).click();
      await page.keyboard.press("End");
      await page.keyboard.type(" Local draft.");
      // Within the autosave delay, so this tab is still dirty.
      await ingestUpdate(elsewhere.page, {
        title,
        contentId,
        markdown: "Rewritten elsewhere.",
      });
    } finally {
      await elsewhere.close();
    }

    const notice = page.getByTestId("remote-change-notice");
    await expect(notice).toBeVisible({ timeout: 5_000 });
    await expect(editor(page)).toContainText("Local draft.");

    // Autosave waits while the choice is open, so the draft is not saved.
    await page.waitForTimeout(2_500);
    await expect(notice).toBeVisible();

    await notice.getByRole("button", { name: "Reload" }).click();
    await expect(editor(page)).toContainText("Rewritten elsewhere.");
    await expect(editor(page)).not.toContainText("Local draft.");
    await expect(notice).toHaveCount(0);
  });

  test("ignores this tab's own saves", async ({ page }) => {
    const autosave = page.waitForResponse(
      (response) =>
        response.url().includes("/_server") &&
        response.request().method() === "POST",
      { timeout: 6_000 },
    );
    await editor(page).click();
    await page.keyboard.press("End");
    await page.keyboard.type(" Saved here.");
    expect((await autosave).ok(), "autosave should succeed").toBe(true);
    // Let the echoed notes:changed event arrive and be ignored.
    await page.waitForTimeout(1_000);
    await expect(editor(page)).toContainText("Original body. Saved here.");
    await expect(page.getByTestId("remote-change-notice")).toHaveCount(0);
    // The cursor stays at the end, so typing continues the same line.
    await page.keyboard.type(" More.");
    await expect(editor(page)).toContainText("Saved here. More.");
  });
});

test("typing keeps going while another note changes elsewhere", async ({
  page,
  browser,
}) => {
  const noteId = await createNoteFixture(page, {
    title: `Live focus ${uniqueSuffix()}`,
    markdown: "Focus body.",
  });
  await page.goto(`/docs/${noteId}`);
  await waitForAppReady(page);
  await waitForLiveSocket(page);
  await editor(page).click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Before.");

  const elsewhere = await openElsewhere(browser);
  try {
    await createNoteFixture(elsewhere.page, {
      title: `Live other ${uniqueSuffix()}`,
      markdown: "Unrelated note.",
    });
  } finally {
    await elsewhere.close();
  }
  // Give the event and the list refresh time to land mid-typing.
  await page.waitForTimeout(1_000);
  await page.keyboard.type(" After.");
  await expect(editor(page)).toContainText("Focus body. Before. After.");
});
