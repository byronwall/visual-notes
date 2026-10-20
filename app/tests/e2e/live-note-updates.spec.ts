import { expect, test, type Browser, type Page } from "@playwright/test";
import { storageStatePath } from "./global-setup";
import { createNoteFixture, uniqueSuffix } from "./helpers/fixtures";
import { waitForAppReady } from "./helpers/readiness";

// Live note updates: a write made somewhere other than this tab must reach it
// without a reload and must never drop typing. The "elsewhere" writer is a
// second browser context, like a second tab or device; when both edit at
// once, the server's per-block merge keeps both edits.

const waitForLiveSocket = (page: Page) =>
  expect(page.locator("html")).toHaveAttribute("data-note-live", "open");

const editor = (page: Page) => page.locator(".ProseMirror").first();

const openContext = async (browser: Browser, path: string) => {
  const context = await browser.newContext({ storageState: storageStatePath });
  const page = await context.newPage();
  await page.goto(path);
  await waitForAppReady(page);
  return { page, close: () => context.close() };
};

const openNote = async (page: Page, noteId: string) => {
  await page.goto(`/docs/${noteId}`);
  await waitForAppReady(page);
  await waitForLiveSocket(page);
};

/** Puts the cursor at the end of the paragraph that shows `text`. */
const typeInParagraph = async (page: Page, text: string, typed: string) => {
  await editor(page).locator("p", { hasText: text }).click();
  await page.keyboard.press("End");
  await page.keyboard.type(typed);
};

/** The editor's autosave: the saveDocContent server action, not any POST. */
const nextAutosave = (page: Page) =>
  page.waitForResponse(
    (response) =>
      response.url().includes("/_server") &&
      response.request().method() === "POST" &&
      (response.request().headers()["x-server-id"] ?? "").includes(
        "saveDocContent",
      ),
    { timeout: 8_000 },
  );

test("a note created elsewhere appears in the open notes list", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await waitForAppReady(page);
  await waitForLiveSocket(page);

  const elsewhere = await openContext(browser, "/login");
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

  test.beforeEach(async ({ page }) => {
    noteId = await createNoteFixture(page, {
      title: `Live note ${uniqueSuffix()}`,
      markdown: "First paragraph.\n\nSecond paragraph.",
    });
    await openNote(page, noteId);
    await expect(editor(page)).toContainText("Second paragraph.");
  });

  test("takes an edit from another tab while idle", async ({
    page,
    browser,
  }) => {
    const other = await openContext(browser, `/docs/${noteId}`);
    try {
      const saved = nextAutosave(other.page);
      await typeInParagraph(
        other.page,
        "Second paragraph.",
        " From the other tab.",
      );
      expect((await saved).ok()).toBe(true);
    } finally {
      await other.close();
    }

    await expect(editor(page)).toContainText(
      "Second paragraph. From the other tab.",
      { timeout: 5_000 },
    );
  });

  test("edits in both tabs at once are merged, not dropped", async ({
    page,
    browser,
  }) => {
    const other = await openContext(browser, `/docs/${noteId}`);
    await waitForLiveSocket(other.page);
    try {
      // Both drafts are unsaved at the same time; whichever saves second
      // merges per block with the first.
      await typeInParagraph(other.page, "Second paragraph.", " Theirs.");
      await typeInParagraph(page, "First paragraph.", " Mine.");

      for (const tab of [page, other.page]) {
        await expect(editor(tab)).toContainText("First paragraph. Mine.", {
          timeout: 8_000,
        });
        await expect(editor(tab)).toContainText("Second paragraph. Theirs.", {
          timeout: 8_000,
        });
      }
    } finally {
      await other.close();
    }

    // The stored note has both edits too.
    await page.reload();
    await waitForAppReady(page);
    await expect(editor(page)).toContainText("First paragraph. Mine.");
    await expect(editor(page)).toContainText("Second paragraph. Theirs.");
  });

  test("ignores this tab's own saves", async ({ page }) => {
    const saved = nextAutosave(page);
    await typeInParagraph(page, "First paragraph.", " Saved here.");
    expect((await saved).ok(), "autosave should succeed").toBe(true);
    // Let the echoed notes:changed event arrive and be ignored.
    await page.waitForTimeout(1_000);
    // The cursor stays at the end, so typing continues the same line.
    await page.keyboard.type(" More.");
    await expect(editor(page)).toContainText(
      "First paragraph. Saved here. More.",
    );
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
  await openNote(page, noteId);
  await typeInParagraph(page, "Focus body.", " Before.");

  const elsewhere = await openContext(browser, "/login");
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
