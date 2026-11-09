import { expect, test, type Browser, type Page } from "@playwright/test";
import { storageStatePath } from "./global-setup";
import { createNoteFixture, uniqueSuffix } from "./helpers/fixtures";
import { waitForAppReady } from "./helpers/readiness";
import { isServerFn } from "./helpers/server-fn-id";

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
      isServerFn(response.request().headers()["x-server-id"], "saveDocContent"),
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

test("a note created elsewhere appears in the sidebar Recent list", async ({
  page,
  browser,
}) => {
  // A note page has no notes list, so Recent is the only place it can show.
  const targetId = await createNoteFixture(page, {
    title: `Live target ${uniqueSuffix()}`,
    markdown: "Open while an agent writes.",
  });
  await openNote(page, targetId);

  const elsewhere = await openContext(browser, "/login");
  const title = `Live recent ${uniqueSuffix()}`;
  try {
    await createNoteFixture(elsewhere.page, {
      title,
      markdown: "Created in another context.",
    });
  } finally {
    await elsewhere.close();
  }

  await expect(
    page.getByRole("region", { name: "Recent" }).getByText(title),
  ).toBeVisible({ timeout: 5_000 });
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

test("a deferred remote edit does not follow the editor to the next note", async ({
  page,
  browser,
}) => {
  const nextId = await createNoteFixture(page, {
    title: `Live switch next ${uniqueSuffix()}`,
    markdown: "Next note body.",
  });
  const noteId = await createNoteFixture(page, {
    title: `Live switch ${uniqueSuffix()}`,
    markdown: "First note body.",
  });
  await openNote(page, noteId);
  // The cursor in this block makes a remote edit to it wait for blur.
  await editor(page).locator("p", { hasText: "First note body." }).click();

  // The live event makes this tab read the newer version, then defer it.
  const remoteRead = page.waitForResponse(
    async (response) =>
      response.url().includes("/_server") &&
      (await response.text()).includes("Remote."),
    { timeout: 8_000 },
  );
  const other = await openContext(browser, `/docs/${noteId}`);
  try {
    const saved = nextAutosave(other.page);
    await typeInParagraph(other.page, "First note body.", " Remote.");
    expect((await saved).ok()).toBe(true);
  } finally {
    await other.close();
  }
  expect((await remoteRead).ok()).toBe(true);
  await expect(editor(page)).not.toContainText("Remote.");

  // A note link click sends this event; the editor keeps focus and is reused.
  await page.evaluate((href) => {
    window.dispatchEvent(
      new CustomEvent("note-link:navigate", { detail: href }),
    );
  }, `/docs/${nextId}`);
  await expect(page).toHaveURL(new RegExp(`/docs/${nextId}`));
  await expect(editor(page)).toContainText("Next note body.");
  // Before the fix, blur applied the first note's deferred content here.
  await editor(page).evaluate((el) => (el as HTMLElement).blur());
  await expect(editor(page)).toContainText("Next note body.");
  await expect(editor(page)).not.toContainText("First note body.");
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
