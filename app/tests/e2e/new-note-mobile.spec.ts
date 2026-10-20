import { devices, expect, test } from "@playwright/test";
import { createNoteFixture, uniqueSuffix } from "./helpers/fixtures";
import { waitForAppReady } from "./helpers/readiness";

// Phone regressions. A Pixel profile reports an Android user agent, so it
// takes the same TipTap mobile focus path as the iOS home-screen PWA.
const { defaultBrowserType: _browser, ...pixel } = devices["Pixel 7"];
test.use(pixel);

const collectPageErrors = (page: import("@playwright/test").Page) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
};

// Opening New note threw "Applying a mismatched transaction": TipTap's focus
// command calls view.dom.focus() synchronously on phones, and the core
// focusEvents extension dispatched its own transaction from inside that
// event. The test only opens the dialog and types; it never saves a note.
test("new note opens and accepts typing on a phone", async ({ page }) => {
  const pageErrors = collectPageErrors(page);

  await page.goto("/");
  await waitForAppReady(page);
  await page
    .getByRole("banner")
    .getByRole("button", { name: "New note" })
    .tap();

  const dialog = page.getByRole("dialog");
  const editor = dialog.locator(".ProseMirror");
  await expect(editor).toBeVisible();
  await expect(editor).toBeFocused();
  // Phone sheet: the actions sit above the editor, clear of the keyboard.
  const create = dialog.getByRole("button", { name: "Create note" });
  const editorTop = (await editor.boundingBox())!.y;
  expect((await create.boundingBox())!.y).toBeLessThan(editorTop);

  await page.keyboard.type("Phone draft");
  await expect(editor.locator("h1")).toHaveText("Phone draft");
  expect(pageErrors).toEqual([]);

  await dialog.getByRole("button", { name: "Cancel" }).tap();
  await expect(dialog).toBeHidden();
});

test.describe("note page on a phone", () => {
  let noteId: string;

  test.beforeEach(async ({ page }) => {
    // Heading matches the title (the usual case), so the page shows the
    // heading as the title rather than the inline title editor.
    const title = `Phone note ${uniqueSuffix()}`;
    noteId = await createNoteFixture(page, {
      title,
      markdown: [
        `# ${title}`,
        "Intro paragraph.",
        ...["Budget", "Timeline", "Open questions"].flatMap((heading) => [
          `## ${heading}`,
          ...Array.from({ length: 14 }, (_, i) => `${heading} line ${i + 1}.`),
        ]),
      ].join("\n\n"),
    });
  });

  // Mounting the docked toolbar used to suspend the page (its AI menu reads
  // a resource), which swapped the note for its skeleton and blurred the
  // editor the moment it gained focus.
  test("editing docks the toolbar and keeps focus", async ({ page }) => {
    const pageErrors = collectPageErrors(page);
    await page.goto(`/docs/${noteId}`);
    await waitForAppReady(page);

    const dockedBar = page.locator("[data-phone-keyboard-toolbar]");
    await expect(dockedBar).toHaveCount(0);

    const editor = page.locator("article .ProseMirror");
    await editor.getByText("Intro paragraph.").tap();
    await expect(editor).toBeFocused();
    await expect(dockedBar).toBeVisible();

    await dockedBar.getByRole("button", { name: /bold/i }).first().tap();
    await expect(editor).toBeFocused();
    expect(pageErrors).toEqual([]);
  });

  test("contents sheet replaces the rail and jumps to a heading", async ({
    page,
  }) => {
    await page.goto(`/docs/${noteId}`);
    await waitForAppReady(page);

    await page
      .getByRole("banner")
      .getByRole("button", { name: "Contents" })
      .tap();
    const contents = page.getByRole("navigation", { name: "Contents" });
    await contents.getByRole("button", { name: "Timeline" }).tap();
    await expect(contents).toBeHidden();

    const heading = page.locator("article h2", { hasText: "Timeline" });
    await expect
      .poll(async () => (await heading.boundingBox())?.y ?? -1)
      .toBeLessThan(120);
  });
});
